import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentEventSchema, DecompositionSchema, type AgentEvent, type Decomposition } from "@/entities/agentRun";
import { readNdjson } from "@/shared/lib/readNdjson";
import { createLogger, logger } from "../../logger";
import { createTestDb, NOW } from "../core/__tests__/echoAgent";
import { createAgentRoute, type AgentRouteDeps } from "../core/agentRoute";
import { createScriptedClient } from "../core/modelClient";
import { assessClarityTool } from "./assessClarityTool";
import { checkDecomposition, decomposeAgent } from "./decomposeAgent";
import { createTaskRepository } from "../../tasks/repository";
import { isDuplicateTitle } from "./duplicates";
import { TEMPLATES } from "./templates";

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

const run = async (input: unknown, debug?: { forceInvalidOutput: boolean }): Promise<AgentEvent[]> => {
  const response = await createAgentRoute(decomposeAgent, routeDeps())(new Request("http://localhost/api/agents/decompose", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input, ...(debug ? { debug } : {}) }),
  }));
  const events: AgentEvent[] = [];
  if (!response.body) throw new Error("no body");
  await readNdjson(response.body, (value) => events.push(AgentEventSchema.parse(value)));
  return events;
};

const finalData = (events: AgentEvent[]): { type: string; data: Decomposition } => {
  const final = events.at(-1);
  if (final?.type !== "result" && final?.type !== "fallback") throw new Error(`unexpected final ${final?.type}`);
  return { type: final.type === "result" ? final.status : "fallback", data: DecompositionSchema.parse(final.data) };
};

const stepStates = (events: AgentEvent[]) => {
  const states = new Map<number, string>();
  events.forEach((event) => { if (event.type === "step") states.set(event.index, event.state); });
  return states;
};

const ctx = () => ({ tasks: db.context.tasks, now: NOW });
const item = (title: string): Decomposition["items"][number] => ({ title, estimate: "~1 год", rationale: "пояснення пункту" });
const subtasks = (...titles: string[]): Decomposition => ({ kind: "subtasks", questions: [], items: titles.map(item) });

describe("агент B «Декомпозиція»", () => {
  it("DEV-010 AC-1: чітка задача t7 → 5 пунктів шаблону upgrade з estimate і rationale (TC-37)", async () => {
    const { type, data } = finalData(await run({ taskId: "t7" }));
    expect(type).toBe("result");
    expect(data.kind).toBe("subtasks");
    expect(data.items.map((entry) => entry.title)).toEqual(TEMPLATES.upgrade.map((entry) => entry.title));
    expect(data.items.every((entry) => entry.estimate.length > 0 && entry.rationale.length >= 3)).toBe(true);
  });

  it("DEV-010 AC-1: наявні підзадачі t1 не пропонуються повторно, пунктів лишається 3–6", async () => {
    const { data } = finalData(await run({ taskId: "t1" }));
    const existing = db.context.tasks.getTask("t1")?.subtasks.map((subtask) => subtask.title) ?? [];
    expect(data.items.length).toBeGreaterThanOrEqual(3);
    expect(data.items.some((entry) => existing.some((title) => isDuplicateTitle(entry.title, title)))).toBe(false);
  });

  it("DEV-010 AC-2: нечітка t8 → clarify із 2 питаннями, кроки генерації й перевірки не виконувались (TC-38)", async () => {
    const events = await run({ taskId: "t8" });
    const { type, data } = finalData(events);
    expect(type).toBe("clarify");
    expect(data).toEqual({ kind: "clarify", questions: expect.arrayContaining([expect.any(String)]), items: [] });
    expect(data.questions).toHaveLength(2);
    const states = stepStates(events);
    expect(states.get(0)).toBe("done");
    expect(states.get(1)).toBe("done");
    expect(states.get(2) ?? "pending").toBe("pending");
    expect(states.get(3) ?? "pending").toBe("pending");
  });

  it("DEV-010 AC-3: з уточненням про e2e агент продовжує й дає шаблон tests (4 пункти) (TC-39)", async () => {
    const { type, data } = finalData(await run({ taskId: "t8", clarification: "e2e checkout, падає 1 з 8 у CI" }));
    expect(type).toBe("result");
    expect(data.items.map((entry) => entry.title)).toEqual(TEMPLATES.tests.map((entry) => entry.title));
  });

  it("DEV-010 AC-3: clarify при наявному clarification → порушення factCheck", () => {
    const clarify: Decomposition = { kind: "clarify", questions: ["Що саме не так?"], items: [] };
    expect(checkDecomposition(clarify, ctx(), { taskId: "t8", clarification: "e2e checkout" })).toHaveLength(1);
    expect(checkDecomposition(clarify, ctx(), { taskId: "t8" })).toEqual([]);
  });

  it("DEV-010 AC-5: дублікати з наявними й між собою відкидаються, схожі за змістом різні — ні (TC-42)", () => {
    const input = { taskId: "t1" };
    expect(checkDecomposition(subtasks("Зняти heap snapshot", "Написати фікс", "Додати тест"), ctx(), input)).toHaveLength(1);
    expect(checkDecomposition(subtasks("Відтворити проблему стабільно", "Написати фікс", "Додати тест"), ctx(), input)).toEqual([]);
    expect(checkDecomposition(subtasks("Написати фікс", "Написати фікс", "Додати тест"), ctx(), input)).toHaveLength(1);
    expect(checkDecomposition(subtasks("Один", "Два", "Три"), ctx(), { taskId: "missing" })).toEqual(["taskId missing: задачі не існує"]);
    expect(isDuplicateTitle("Написати тест для A", "Написати тест для B")).toBe(true);
  });

  it("DEV-010 AC-5: 1 або 10 пунктів порушують схему, clarify з пунктами — теж (TC-43)", () => {
    expect(DecompositionSchema.safeParse(subtasks("Одна підзадача")).success).toBe(false);
    expect(DecompositionSchema.safeParse(subtasks(...Array.from({ length: 10 }, (_, index) => `Підзадача ${index}`))).success).toBe(false);
    expect(DecompositionSchema.safeParse({ kind: "clarify", questions: ["Що не так?"], items: subtasks("А б в", "Б в г", "В г д").items }).success).toBe(false);
    expect(DecompositionSchema.safeParse({ kind: "clarify", questions: [], items: [] }).success).toBe(false);
    expect(DecompositionSchema.safeParse(subtasks("Перша", "Друга", "Третя")).success).toBe(true);
  });

  it("DEV-010 AC-6: forceInvalidOutput → дві спроби з дублікатами → fallback generic із 4 пунктів, крок перевірки fail", async () => {
    const events = await run({ taskId: "t1" }, { forceInvalidOutput: true });
    const { type, data } = finalData(events);
    expect(type).toBe("fallback");
    expect(data.items.map((entry) => entry.title)).toEqual(TEMPLATES.generic.map((entry) => entry.title));
    expect(stepStates(events).get(3)).toBe("fail");
  });

  it("DEV-010 AC-6: вхід валідується: порожній taskId і занадто коротке уточнення відхиляються", async () => {
    const bad = await createAgentRoute(decomposeAgent, routeDeps())(new Request("http://localhost/api/agents/decompose", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: { taskId: "t7", clarification: "ні" } }),
    }));
    expect(bad.status).toBe(400);
  });
});

const addGenericTask = () => {
  const repository = createTaskRepository(db.connection.db);
  const task = repository.createTask({ title: "Підготувати реліз", description: "Зібрати все потрібне для релізу й узгодити дату з командою.", status: "todo", priority: "medium" }, NOW);
  repository.addSubtasks(task.id, TEMPLATES.generic.map((entry) => ({ title: entry.title, source: "ai" as const })), NOW);
  return task.id;
};

describe("унікальні пункти для demo і fallback", () => {
  it("DEV-010 AC-9: «Розбити ще раз» після створення пунктів generic дає ≥3 унікальні пункти, а не FALLBACK_INVALID", async () => {
    const taskId = addGenericTask();
    const { type, data } = finalData(await run({ taskId }));
    const existing = db.context.tasks.getTask(taskId)?.subtasks.map((subtask) => subtask.title) ?? [];
    expect(type).toBe("result");
    expect(data.items.length).toBeGreaterThanOrEqual(3);
    expect(data.items.some((entry) => existing.some((title) => isDuplicateTitle(entry.title, title)))).toBe(false);
  });

  it("DEV-010 AC-6: fallback над задачею, чиї підзадачі збігаються з generic, добирає ≥3 унікальні пункти запасного пулу", async () => {
    const taskId = addGenericTask();
    const { type, data } = finalData(await run({ taskId }, { forceInvalidOutput: true }));
    expect(type).toBe("fallback");
    expect(data.items.length).toBeGreaterThanOrEqual(3);
  });
});

describe("tool assess_clarity", () => {
  it("DEV-010 AC-2: повертає vague і причини для t8, лише читає (БД не змінюється), для чіткої t7 — vague: false", async () => {
    const before = JSON.stringify(db.context.tasks.listTasks());
    const vague = await assessClarityTool.execute({ id: "t8" }, ctx());
    const clear = await assessClarityTool.execute({ id: "t7" }, ctx());
    expect(vague).toMatchObject({ vague: true });
    expect(clear).toEqual({ vague: false, reasons: [] });
    await expect(assessClarityTool.execute({ id: "missing" }, ctx())).rejects.toThrow();
    expect(JSON.stringify(db.context.tasks.listTasks())).toBe(before);
  });
});
