import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentEventSchema, TriageSchema, type AgentEvent, type StuckRadarInput, type Triage } from "@/entities/agentRun";
import { readNdjson } from "@/shared/lib/readNdjson";
import { createLogger, logger } from "../../logger";
import { createTaskRepository } from "../../tasks/repository";
import { createTestDb, NOW, type TestDb } from "../core/__tests__/echoAgent";
import { createAgentRoute, type AgentRouteDeps } from "../core/agentRoute";
import { createScriptedClient } from "../core/modelClient";
import { checkTriage } from "./checkTriage";
import { diagnose } from "./diagnose";
import { buildItem, reviewDraft } from "./drafts";
import { findStaleTasks } from "./staleTasks";
import { GHOST_TASK_ID, stuckRadarAgent } from "./stuckRadarAgent";

const DEMO_ENV = { aiMode: "demo", OPENAI_API_KEY: undefined, OPENAI_MODEL: "test" } as const;
const silent = createLogger({ level: "silent", destination: { write: () => undefined } });

let db: TestDb;

beforeEach(async () => {
  db = await createTestDb();
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

const run = async (input: unknown, debug?: { forceInvalidOutput: boolean }): Promise<AgentEvent[]> => {
  const response = await createAgentRoute(stuckRadarAgent, routeDeps())(new Request("http://localhost/api/agents/stuck-radar", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input, ...(debug ? { debug } : {}) }),
  }));
  const events: AgentEvent[] = [];
  if (!response.body) throw new Error("no body");
  await readNdjson(response.body, (value) => events.push(AgentEventSchema.parse(value)));
  return events;
};

const finalTriage = (events: AgentEvent[]): { type: string; data: Triage } => {
  const final = events.at(-1);
  if (final?.type !== "result" && final?.type !== "fallback") throw new Error(`unexpected final ${final?.type}`);
  return { type: final.type, data: TriageSchema.parse(final.data) };
};

const ctx = () => ({ tasks: db.context.tasks, now: NOW });
const task = (id: string) => {
  const found = db.context.tasks.getTask(id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};
const staleIds = (snoozed: string[] = []) => findStaleTasks(ctx(), snoozed).map(({ task: item }) => item.id).sort();
const item = (overrides: Partial<Triage["items"][number]>): Triage["items"][number] => ({
  taskId: "t3", cause: "vague", why: "Немає ні підзадач, ні нотаток.", action: "split", draft: null, ...overrides,
});
const inputOf: StuckRadarInput = { snoozedIds: [] };

describe("агент D «Радар застряглих»", () => {
  it("DEV-012 AC-1: find_stale_tasks(3) на seed → t1, t3, t12; не t9, t2/t7, t6; відкладені виключено (TC-52)", () => {
    expect(staleIds()).toEqual(["t1", "t12", "t3"]);
    expect(staleIds(["t12"])).toEqual(["t1", "t3"]);
  });

  it("DEV-012 AC-2: diagnose t1 → waiting-review, t3 → vague, t12 → too-big, інакше no-activity (TC-53…55)", () => {
    expect(diagnose(task("t1")).cause).toBe("waiting-review");
    expect(diagnose(task("t3")).cause).toBe("vague");
    expect(diagnose(task("t12")).cause).toBe("too-big");
    expect(diagnose(task("t12")).why).toMatch(/^3 відкриті підзадачі/);
    expect(diagnose({ subtasks: task("t9").subtasks.slice(0, 1), notes: [{ ...task("t9").notes[0]!, text: "Просто нотатка" }] }).cause).toBe("no-activity");
  });

  it("DEV-012 AC-2: пріоритет правил — PR у нотатці + 4 відкриті підзадачі → waiting-review", () => {
    const open = { ...task("t12").subtasks[0]!, status: "todo" as const };
    const note = { ...task("t1").notes[0]!, text: "Чекаю ревʼю на PR #5" };
    expect(diagnose({ subtasks: [open, open, open, open], notes: [note] }).cause).toBe("waiting-review");
  });

  it("DEV-012 AC-3: mock повертає валідний Triage; чернетка t1 з «PR #318»; дія відповідає причині", async () => {
    const events = await run(inputOf);
    const { type, data } = finalTriage(events);
    expect(type).toBe("result");
    expect(data.items.map((entry) => entry.taskId).sort()).toEqual(["t1", "t12", "t3"]);
    const t1 = data.items.find((entry) => entry.taskId === "t1");
    expect(t1).toMatchObject({ cause: "waiting-review", action: "draft-review" });
    expect(t1?.draft).toContain("PR #318");
    expect(data.items.find((entry) => entry.taskId === "t3")).toMatchObject({ action: "split", draft: null });
    expect(data.items.find((entry) => entry.taskId === "t12")).toMatchObject({ action: "draft-help" });
    expect(checkTriage(data, ctx(), inputOf)).toEqual([]);
  });

  it("DEV-012 AC-4: taskId поза знайденими, split для waiting-review, «PR #999», відкладена задача — порушення", () => {
    expect(checkTriage({ items: [item({ taskId: "t9" })] }, ctx(), inputOf)).toHaveLength(1);
    expect(checkTriage({ items: [item({ taskId: "t1", cause: "waiting-review", action: "split" })] }, ctx(), inputOf)).toHaveLength(1);
    const review = (draft: string) => item({ taskId: "t1", cause: "waiting-review", action: "draft-review", draft });
    expect(checkTriage({ items: [review("Привіт! Глянь, будь ласка, PR #999 по задачі.")] }, ctx(), inputOf)).toEqual(["У тексті згадано PR #999, якого немає в нотатках"]);
    expect(checkTriage({ items: [review("Привіт! Глянь, будь ласка, PR #318 по задачі.")] }, ctx(), inputOf)).toEqual([]);
    expect(checkTriage({ items: [item({ taskId: "t3" })] }, ctx(), { snoozedIds: ["t3"] })).toHaveLength(1);
    expect(checkTriage({ items: [review("Привіт! @channel глянь PR #318, будь ласка.")] }, ctx(), inputOf)).toHaveLength(1);
    expect(checkTriage({ items: [item({ draft: "зайва чернетка для split" })] }, ctx(), inputOf)).toHaveLength(1);
  });

  it("DEV-012 AC-4: forceInvalidOutput → fallback: усі знайдені, дія open, без чернеток; крок 4 fail", async () => {
    const events = await run(inputOf, { forceInvalidOutput: true });
    const { type, data } = finalTriage(events);
    expect(type).toBe("fallback");
    expect(data.items.map((entry) => entry.taskId).sort()).toEqual(["t1", "t12", "t3"]);
    expect(data.items.every((entry) => entry.action === "open" && entry.draft === null)).toBe(true);
    expect(data.items.some((entry) => entry.taskId === GHOST_TASK_ID)).toBe(false);
    expect(events.some((event) => event.type === "step" && event.index === 3 && event.state === "fail")).toBe(true);
  });

  it("DEV-012 AC-4: чернетка й fallback проходять перевірку для задачі з «#42», @here і довгою назвою", async () => {
    const repository = createTaskRepository(db.connection.db);
    const created = await repository.createTask({ title: `@here Bug #42 ${"д".repeat(200)}`, description: "Опис задачі для перевірки радара.", status: "in-progress", priority: "medium" }, new Date(NOW.getTime() - 10 * 86_400_000));
    await repository.addNote(created.id, { text: "Чекаю ревʼю на PR #7 @channel" }, new Date(NOW.getTime() - 10 * 86_400_000));
    await db.refreshContext();
    const full = task(created.id);
    expect(buildItem(full).draft?.length).toBeLessThanOrEqual(500);
    expect(checkTriage({ items: [buildItem(full)] }, ctx(), inputOf)).toEqual([]);
    expect(reviewDraft(full)).not.toContain("@here");
  });

  it("DEV-012 AC-8: без застряглих → items [], tool diagnose_hint і get_task_context не викликались", async () => {
    const events = await run({ snoozedIds: ["t1", "t3", "t12"] });
    const { type, data } = finalTriage(events);
    expect(type).toBe("result");
    expect(data.items).toEqual([]);
    const tools = events.flatMap((event) => (event.type === "step" && event.detail ? [event.detail] : []));
    expect(tools.join(" ")).not.toContain("diagnose_hint");
  });

  it("DEV-012 AC-4: невалідний вхід (чужі поля, більше 100 відкладених) → 400", async () => {
    const call = (input: unknown) => createAgentRoute(stuckRadarAgent, routeDeps())(new Request("http://localhost/api/agents/stuck-radar", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input }),
    }));
    expect((await call({ snoozedIds: [], extra: 1 })).status).toBe(400);
    expect((await call({ snoozedIds: Array.from({ length: 101 }, (_, index) => `t${index}`) })).status).toBe(400);
  });
});
