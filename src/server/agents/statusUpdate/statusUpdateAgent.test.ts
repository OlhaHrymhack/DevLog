import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentEventSchema, StatusUpdateSchema, type AgentEvent, type StatusUpdate } from "@/entities/agentRun";
import { readNdjson } from "@/shared/lib/readNdjson";
import { createLogger, logger } from "../../logger";
import { createTaskRepository } from "../../tasks/repository";
import { createTestDb, NOW } from "../core/__tests__/echoAgent";
import { createAgentRoute, type AgentRouteDeps } from "../core/agentRoute";
import { createScriptedClient } from "../core/modelClient";
import { buildUpdate } from "./buildUpdate";
import { checkStatusUpdate } from "./checkStatusUpdate";
import { INVALID_PR, statusUpdateAgent } from "./statusUpdateAgent";
import { suggestToneTool } from "./suggestToneTool";
import { autoTone } from "./tone";

const DEMO_ENV = { aiMode: "demo", OPENAI_API_KEY: undefined, OPENAI_MODEL: "test" } as const;
const silent = createLogger({ level: "silent", destination: { write: () => undefined } });

let db: ReturnType<typeof createTestDb>;

beforeEach(() => {
  db = createTestDb();
  vi.spyOn(logger, "info").mockImplementation(() => undefined);
  vi.spyOn(logger, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  db.connection.close();
  vi.restoreAllMocks();
});

const routeDeps = (): AgentRouteDeps => ({
  getDb: () => db.connection.db,
  getEnv: () => DEMO_ENV,
  createClient: (_env, script) => createScriptedClient(script()),
  now: () => NOW,
  logger: silent,
});

const call = (input: unknown, debug?: { forceInvalidOutput: boolean }) =>
  createAgentRoute(statusUpdateAgent, routeDeps())(new Request("http://localhost/api/agents/status-update", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input, ...(debug ? { debug } : {}) }),
  }));

const run = async (input: unknown, debug?: { forceInvalidOutput: boolean }): Promise<AgentEvent[]> => {
  const response = await call(input, debug);
  const events: AgentEvent[] = [];
  if (!response.body) throw new Error("no body");
  await readNdjson(response.body, (value) => events.push(AgentEventSchema.parse(value)));
  return events;
};

const finalUpdate = (events: AgentEvent[]): { type: string; data: StatusUpdate } => {
  const final = events.at(-1);
  if (final?.type !== "result" && final?.type !== "fallback") throw new Error(`unexpected final ${final?.type}`);
  return { type: final.type, data: StatusUpdateSchema.parse(final.data) };
};

const ctx = () => ({ tasks: db.context.tasks, now: NOW });
const task = (id: string) => {
  const found = db.context.tasks.getTask(id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};
const update = (overrides: Partial<StatusUpdate>): StatusUpdate => ({
  tone: "team", text: "*Задача*: апдейт\nПоки без помітного прогресу, беру в роботу.", mentions: { subtaskIds: [], noteIds: [] }, thin: false, ...overrides,
});

describe("агент C «Статус-апдейт»", () => {
  it("DEV-011 AC-1: mock на t9 (team) → апдейт у стилі Slack з даних задачі (TC-45)", async () => {
    const { type, data } = finalUpdate(await run({ taskId: "t9", tone: "team" }));
    const lines = data.text.split("\n");
    expect(type).toBe("result");
    expect(data.tone).toBe("team");
    expect(lines[0]).toBe("*Rate limiting для /api/agents*: апдейт");
    expect(lines.some((line) => line.startsWith("Готово: вибрати алгоритм"))).toBe(true);
    expect(lines.some((line) => line.startsWith("Нотатка: Token bucket"))).toBe(true);
    expect(lines.some((line) => line.startsWith("Далі: middleware"))).toBe(true);
    expect(data.mentions.noteIds).toHaveLength(1);
  });

  it("DEV-011 AC-2: autoTone — t1 (гаряча) і t2 (дедлайн) → manager, t9 (свіжа) і t6 (done) → team (TC-46)", () => {
    expect(autoTone(task("t1"), NOW).tone).toBe("manager");
    expect(autoTone(task("t2"), NOW).tone).toBe("manager");
    expect(autoTone(task("t9"), NOW).tone).toBe("team");
    expect(autoTone(task("t6"), NOW).tone).toBe("team");
  });

  it("DEV-011 AC-2: tone auto на t1 → менеджерський апдейт із «Ризик: чекаємо на ревʼю» без емодзі", async () => {
    const { data } = finalUpdate(await run({ taskId: "t1", tone: "auto" }));
    expect(data.tone).toBe("manager");
    expect(data.text).toContain("Ризик: чекаємо на ревʼю, це блокує реліз.");
    expect(data.text).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(await suggestToneTool.execute({ id: "t1" }, ctx())).toMatchObject({ tone: "manager" });
  });

  it("DEV-011 AC-3: ручний тон short → один рядок до 200 символів; humor із serious → 400 (TC-47)", async () => {
    const { data } = finalUpdate(await run({ taskId: "t1", tone: "short" }));
    expect(data.tone).toBe("short");
    expect(data.text.includes("\n")).toBe(false);
    expect(data.text.length).toBeLessThanOrEqual(200);
    expect((await call({ taskId: "t1", tone: "humor", serious: true })).status).toBe(400);
    expect(finalUpdate(await run({ taskId: "t1", tone: "humor" })).data.tone).toBe("humor");
  });

  it("DEV-011 AC-3: у серйозному режимі закрита задача не отримує емодзі 🎉", async () => {
    const { data } = finalUpdate(await run({ taskId: "t6", tone: "team", serious: true }));
    expect(data.text).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(finalUpdate(await run({ taskId: "t6", tone: "team" })).data.text).toContain("🎉");
  });

  it("DEV-011 AC-4: t3 без підзадач і нотаток → thin: true, без вигаданих «Готово: …» (TC-48)", async () => {
    const { data } = finalUpdate(await run({ taskId: "t3", tone: "team" }));
    expect(data.thin).toBe(true);
    expect(data.text).not.toContain("Готово:");
    expect(data.text).toContain("Поки без помітного прогресу");
    expect(data.mentions).toEqual({ subtaskIds: [], noteIds: [] });
  });

  it("DEV-011 AC-5: «PR #999» при нотатці з «PR #318» — порушення; «PR #318» — ок; чужі subtaskIds — порушення (TC-49, TC-51)", () => {
    const input = { taskId: "t1", tone: "manager" } as const;
    const bad = update({ tone: "manager", text: "*Задача*\nСтатус: в роботі.\nФікс у PR #999, чекаємо ревʼю." });
    expect(checkStatusUpdate(bad, ctx(), input)).toEqual(["У тексті згадано PR #999, якого немає в нотатках"]);
    const good = update({ tone: "manager", text: "*Задача*\nСтатус: в роботі.\nФікс у PR #318, чекаємо ревʼю." });
    expect(checkStatusUpdate(good, ctx(), input)).toEqual([]);
    const foreign = task("t9").subtasks[0]?.id ?? "x";
    expect(checkStatusUpdate(update({ tone: "manager", mentions: { subtaskIds: [foreign], noteIds: [] } }), ctx(), input)).toHaveLength(1);
    expect(checkStatusUpdate(update({ tone: "manager", text: "*Задача*\nПише для менеджера 🎉 успіх." }), ctx(), input)).toHaveLength(1);
    expect(checkStatusUpdate(update({ tone: "short", text: "а".repeat(201) }), ctx(), { taskId: "t1", tone: "short" })).toHaveLength(1);
    expect(checkStatusUpdate(update({ tone: "team" }), ctx(), { taskId: "t1", tone: "manager" })).toHaveLength(1);
  });

  it("DEV-011 AC-5: forceInvalidOutput → дві спроби з «PR #999» → fallback short, крок перевірки fail", async () => {
    const events = await run({ taskId: "t1", tone: "auto" }, { forceInvalidOutput: true });
    const { type, data } = finalUpdate(events);
    expect(type).toBe("fallback");
    expect(data.tone).toBe("short");
    expect(data.text).not.toContain(INVALID_PR);
    expect(events.some((event) => event.type === "step" && event.index === 3 && event.state === "fail")).toBe(true);
  });

  it("DEV-011 AC-5: fallback за ручного тону проходить перевірку; #42 у назві, точний збіг посилань, домени й @channel", async () => {
    const events = await run({ taskId: "t1", tone: "manager" }, { forceInvalidOutput: true });
    expect(finalUpdate(events).type).toBe("fallback");

    const repository = createTaskRepository(db.connection.db);
    const titled = repository.createTask({ title: "Bug #42 у воркері", description: "Опис задачі для перевірки посилань.", status: "todo", priority: "medium" }, NOW);
    repository.addNote(titled.id, { text: "Дивись PR #318 і https://example.com/a." }, NOW);
    const input = { taskId: titled.id, tone: "team" } as const;
    expect(checkStatusUpdate(buildUpdate(task(titled.id), "team", NOW), ctx(), input)).toEqual([]);
    expect(checkStatusUpdate(buildUpdate(task(titled.id), "short", NOW), ctx(), input)).toEqual([]);
    const with318 = (text: string) => checkStatusUpdate(update({ text: `*Задача*: ${text}`, thin: false }), ctx(), input);
    expect(with318("PR #31")).toHaveLength(1);
    expect(with318("PR#318")).toEqual([]);
    expect(with318("https://example.com/a.")).toEqual([]);
    expect(with318("evil.com/login")).toHaveLength(1);
    expect(with318("@channel увага")).toHaveLength(1);
  });

  it("DEV-011 AC-5: емодзі з назви не ламає manager; довга нотатка з URL не розрізає посилання", () => {
    const repository = createTaskRepository(db.connection.db);
    const emoji = repository.createTask({ title: "🔥 Гаряча задача", description: "Опис задачі для перевірки емодзі.", status: "todo", priority: "high" }, NOW);
    repository.addNote(emoji.id, { text: `${"слово ".repeat(120)}https://example.com/very/long/path` }, NOW);
    const built = buildUpdate(task(emoji.id), "manager", NOW);
    expect(checkStatusUpdate(built, ctx(), { taskId: emoji.id, tone: "manager" })).toEqual([]);
    const team = buildUpdate(task(emoji.id), "team", NOW);
    expect(team.text.length).toBeLessThanOrEqual(800);
    expect(checkStatusUpdate(team, ctx(), { taskId: emoji.id, tone: "team" })).toEqual([]);
  });

  it("DEV-011 AC-2: «approach» у нотатці не вигадує ризик «чекаємо на ревʼю»", () => {
    const repository = createTaskRepository(db.connection.db);
    const created = repository.createTask({ title: "Задача з approach", description: "Опис задачі для перевірки ризику.", status: "todo", priority: "medium", dueAt: "2026-11-30T00:00:00.000Z" }, NOW);
    repository.addNote(created.id, { text: "Обрали новий approach до prototype" }, NOW);
    expect(buildUpdate(task(created.id), "manager", NOW).text).not.toContain("ревʼю");
  });

  it("DEV-011 AC-8: текст нотатки з розміткою лишається текстом чернетки (екранує UI), а довгий short обрізається до 200", () => {
    const repository = createTaskRepository(db.connection.db);
    const created = repository.createTask({ title: "Задача з нотаткою", description: "Опис задачі для перевірки нотаток.", status: "todo", priority: "medium" }, NOW);
    repository.addNote(created.id, { text: "<img src=x onerror=alert(1)>" }, NOW);
    const withNote = task(created.id);
    expect(buildUpdate(withNote, "team", NOW).text).toContain("Нотатка: <img src=x onerror=alert(1)>");
    const longTitle = repository.createTask({ title: "Д".repeat(120), description: "Опис задачі для перевірки обрізання.", status: "todo", priority: "medium" }, NOW);
    repository.addSubtasks(longTitle.id, [{ title: "К".repeat(200), source: "user" }], NOW);
    expect(buildUpdate(task(longTitle.id), "short", NOW).text.length).toBeLessThanOrEqual(200);
    expect(StatusUpdateSchema.safeParse(buildUpdate(task(longTitle.id), "short", NOW)).success).toBe(true);
  });
});
