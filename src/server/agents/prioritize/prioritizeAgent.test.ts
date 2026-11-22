import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentEventSchema, DayPlanSchema, type AgentEvent, type DayPlan } from "@/entities/agentRun";
import { readNdjson } from "@/shared/lib/readNdjson";
import { createLogger, logger } from "../../logger";
import { createTestDb, NOW } from "../core/__tests__/echoAgent";
import { createAgentRoute, type AgentRouteDeps } from "../core/agentRoute";
import { createScriptedClient } from "../core/modelClient";
import { FALLBACK_REASONS } from "../core/runAgent";
import { rankActiveTasks, toActiveTaskView } from "./activeTasks";
import { FACTOR_PATTERN } from "./explain";
import { listActiveTasksTool } from "./listActiveTasksTool";
import { checkDayPlan, INVALID_TASK_ID, prioritizeAgent } from "./prioritizeAgent";
import { rulePlan, rulePlanOrder } from "./rulePlan";
import { isUrgent, scoreTask, type ScorableTask } from "./scoreTask";

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

const tasks = () => db.context.tasks.listTasks();
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

const routeDeps = (): AgentRouteDeps => ({
  getDb: () => db.connection.db,
  getEnv: () => DEMO_ENV,
  createClient: (_env, script) => createScriptedClient(script()),
  now: () => NOW,
  logger: silent,
});

const run = async (input: unknown, debug?: { forceInvalidOutput: boolean }): Promise<AgentEvent[]> => {
  const response = await createAgentRoute(prioritizeAgent, routeDeps())(new Request("http://localhost/api/agents/prioritize", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input, ...(debug ? { debug } : {}) }),
  }));
  const events: AgentEvent[] = [];
  if (!response.body) throw new Error("no body");
  await readNdjson(response.body, (value) => events.push(AgentEventSchema.parse(value)));
  return events;
};

const resultPlan = (events: AgentEvent[]): DayPlan => {
  const final = events.at(-1);
  if (final?.type !== "result" && final?.type !== "fallback") throw new Error(`unexpected final ${final?.type}`);
  return DayPlanSchema.parse(final.data);
};

describe("scoreTask і порядок", () => {
  it("DEV-009 AC-1: на seed t2 = 78 (дедлайн +30), t1 = 47,2, t7 = 46 → top-3 t2, t1, t7", () => {
    const byId = new Map(tasks().map((task) => [task.id, task]));
    const score = (id: string) => scoreTask(byId.get(id) ?? (() => { throw new Error(id); })(), NOW);
    expect(score("t2")).toBeCloseTo(78, 5);
    expect(score("t1")).toBeCloseTo(47.2, 5);
    expect(score("t7")).toBeCloseTo(46, 5);
    expect(rankActiveTasks(tasks(), NOW).slice(0, 3).map((task) => task.id)).toEqual(["t2", "t1", "t7"]);
  });

  it("DEV-009 AC-1: дедлайн менше 48 год дає рівно +30 (TC-32)", () => {
    const t2 = tasks().find((task) => task.id === "t2");
    if (!t2) throw new Error("t2");
    expect(isUrgent(t2, NOW)).toBe(true);
    expect(scoreTask(t2, NOW) - scoreTask({ ...t2, dueAt: null }, NOW)).toBeCloseTo(30, 5);
    expect(scoreTask({ ...t2, dueAt: new Date(NOW.getTime() + 49 * 3_600_000).toISOString() }, NOW)).toBeCloseTo(scoreTask({ ...t2, dueAt: null }, NOW), 5);
  });

  it("DEV-009 AC-1: medium in-progress із 7 днями без змін (40) вище за high todo, створену сьогодні (30) — не сортування за пріоритетом (TC-31)", () => {
    const stale: ScorableTask = { priority: "medium", status: "in-progress", createdAt: daysAgo(7), updatedAt: daysAgo(7), dueAt: null };
    const fresh: ScorableTask = { priority: "high", status: "todo", createdAt: daysAgo(0), updatedAt: daysAgo(0), dueAt: null };
    expect(scoreTask(stale, NOW)).toBeCloseTo(40, 5);
    expect(scoreTask(fresh, NOW)).toBeCloseTo(30, 5);
    expect(scoreTask(stale, NOW)).toBeGreaterThan(scoreTask(fresh, NOW));
  });

  it("DEV-009 AC-4: rulePlan на seed — пріоритет → вік → статус: t2, t7, t1; без пояснень", () => {
    expect(rulePlanOrder(tasks(), NOW).slice(0, 3).map((task) => task.id)).toEqual(["t2", "t7", "t1"]);
    const plan = rulePlan(tasks(), NOW);
    expect(plan.items.map((item) => item.taskId)).toEqual(["t2", "t7", "t1"]);
    expect(plan.items.every((item) => item.joke === null)).toBe(true);
    expect(new Set(plan.items.map((item) => item.why)).size).toBe(1);
    expect(plan.deferred).toEqual([]);
    expect(DayPlanSchema.safeParse(plan).success).toBe(true);
    expect(checkDayPlan(plan, db.context)).toEqual([]);
  });
});

describe("tool list_active_tasks", () => {
  it("DEV-009 AC-2: повертає лише активні задачі з вагою й обчисленими полями; limit обрізає", async () => {
    const all = await listActiveTasksTool.execute({ limit: null }, db.context);
    const parsed = z2(all);
    expect(parsed.tasks.some((task) => task.status === "done")).toBe(false);
    expect(parsed.total).toBe(tasks().filter((task) => task.status !== "done").length);
    expect(parsed.tasks.find((task) => task.id === "t2")).toMatchObject({ score: 78, urgent: true, dueInHours: 20, priority: "high" });
    expect(z2(await listActiveTasksTool.execute({ limit: 2 }, db.context)).tasks).toHaveLength(2);
    await expect(listActiveTasksTool.execute({ limit: 0 }, db.context)).rejects.toThrow();
  });

  it("DEV-009 AC-2: подання задачі містить вік, дні без змін і підзадачі", () => {
    const t9 = tasks().find((task) => task.id === "t9");
    if (!t9) throw new Error("t9");
    expect(toActiveTaskView(t9, NOW)).toMatchObject({ ageDays: 3, staleDays: 0, openSubtasks: 2, status: "in-progress" });
  });
});

describe("агент A: mock-цикл", () => {
  it("DEV-009 AC-2: demo-запуск проходить list_active_tasks → submit_result і дає валідний DayPlan (TC-30, TC-33)", async () => {
    const events = await run({ serious: false });
    expect(events[0]).toMatchObject({ type: "run", mode: "demo" });
    expect(events.at(-1)).toMatchObject({ type: "result", status: "result" });
    const plan = resultPlan(events);
    expect(plan.items.map((item) => item.taskId)).toEqual(["t2", "t1", "t7"]);
    expect(plan.items.every((item) => FACTOR_PATTERN.test(item.why))).toBe(true);
    const doneIds = tasks().filter((task) => task.status === "done").map((task) => task.id);
    expect([...plan.items, ...plan.deferred].some((entry) => doneIds.includes(entry.taskId))).toBe(false);
    expect(plan.deferred.length).toBeLessThanOrEqual(2);
    expect(checkDayPlan(plan, db.context)).toEqual([]);
  });

  it("DEV-009 AC-8: з serious: true жартів немає й у поясненнях немає емодзі; без нього є жарт для гарячої задачі", async () => {
    const serious = resultPlan(await run({ serious: true }));
    expect(serious.items.every((item) => item.joke === null)).toBe(true);
    expect(serious.items.every((item) => !/\p{Extended_Pictographic}/u.test(item.why))).toBe(true);

    const playful = resultPlan(await run({ serious: false }));
    expect(playful.items.some((item) => item.joke !== null)).toBe(true);
    expect(playful.items.every((item) => !/\p{Extended_Pictographic}/u.test(item.why))).toBe(true);
  });

  it("DEV-009 AC-2: вхід валідується строго (невідоме поле → 400)", async () => {
    const response = await createAgentRoute(prioritizeAgent, routeDeps())(new Request("http://localhost/api/agents/prioritize", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: { serious: false, extra: 1 } }),
    }));
    expect(response.status).toBe(400);
  });
});

describe("factCheck", () => {
  const plan = (items: string[], deferred: string[] = []): DayPlan => ({
    items: items.map((taskId) => ({ taskId, why: "Високий пріоритет, багато днів без змін.", joke: null })),
    deferred: deferred.map((taskId) => ({ taskId, reason: "може почекати день" })),
  });
  const doneId = () => tasks().find((task) => task.status === "done")?.id ?? "missing";

  it("DEV-009 AC-3: коректний план без порушень", () => {
    expect(checkDayPlan(plan(["t2", "t1", "t7"], ["t5"]), db.context)).toEqual([]);
  });

  it("DEV-009 AC-3: неіснуюча задача #42 → порушення", () => {
    expect(checkDayPlan(plan(["t2", INVALID_TASK_ID]), db.context).join("\n")).toContain("42");
  });

  it("DEV-009 AC-3: done-задача (в items чи deferred) → порушення", () => {
    expect(checkDayPlan(plan(["t2", doneId()]), db.context).join("\n")).toContain("виконана");
    expect(checkDayPlan(plan(["t2", "t1"], [doneId()]), db.context).join("\n")).toContain("виконана");
  });

  it("DEV-009 AC-3: дублікат між items і deferred → порушення", () => {
    expect(checkDayPlan(plan(["t2", "t1"], ["t1"]), db.context).join("\n")).toContain("повторюється");
  });

  it("DEV-009 AC-3: задача з дедлайном < 48 год поза items → порушення; якщо items лише термінові — ні", () => {
    expect(checkDayPlan(plan(["t1", "t7"]), db.context).join("\n")).toContain("t2");
    expect(checkDayPlan(plan(["t2"]), db.context)).toEqual([]);
  });

  it("DEV-009 AC-3: пояснення без жодного фактора → порушення", () => {
    const vague: DayPlan = { items: [{ taskId: "t2", why: "Бо мені так здається, чесно.", joke: null }], deferred: [] };
    expect(checkDayPlan(vague, db.context).join("\n")).toContain("фактор");
  });
});

describe("хибний кейс → fallback", () => {
  it("DEV-009 AC-4: forceInvalidOutput → 2 спроби → fallback rulePlan, крок перевірки fail", async () => {
    const events = await run({ serious: false }, { forceInvalidOutput: true });
    const final = events.at(-1);
    expect(final).toMatchObject({ type: "fallback", reason: FALLBACK_REASONS.invalidResult });
    expect(resultPlan(events).items.map((item) => item.taskId)).toEqual(["t2", "t7", "t1"]);
    const validation = events.filter((event) => event.type === "step" && event.index === 3).at(-1);
    expect(validation).toMatchObject({ type: "step", state: "fail" });
  });
});

const z2 = (value: unknown): { total: number; tasks: { id: string; status: string; score: number }[] } => {
  if (typeof value !== "object" || value === null || !("tasks" in value) || !("total" in value) || !Array.isArray(value.tasks) || typeof value.total !== "number") {
    throw new Error("unexpected tool output");
  }
  return { total: value.total, tasks: value.tasks.map((task: unknown) => {
    if (typeof task !== "object" || task === null) throw new Error("task");
    return { ...task, id: "id" in task ? String(task.id) : "", status: "status" in task ? String(task.status) : "", score: "score" in task ? Number(task.score) : NaN };
  }) };
};
