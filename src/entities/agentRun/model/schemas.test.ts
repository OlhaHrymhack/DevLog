import { describe, expect, it } from "vitest";
import { AgentRunFinishInputSchema, AgentStepAppendInputSchema, AgentStepRecordSchema, AgentStepStateSchema } from "./schemas";

const STEP = {
  id: "s1",
  runId: "r1",
  index: 0,
  type: "model",
  label: "Виклик моделі",
  state: "done",
  detail: null,
  payload: null,
  createdAt: "2026-11-21T12:00:00.000Z",
};

describe("Persisted-схеми трасування агента", () => {
  it("DEV-003 AC-3: AgentStepRecord зі state \"pending\" або \"run\" → помилка; done/fail — ок", () => {
    expect(AgentStepRecordSchema.safeParse({ ...STEP, state: "pending" }).success).toBe(false);
    expect(AgentStepRecordSchema.safeParse({ ...STEP, state: "run" }).success).toBe(false);
    expect(AgentStepRecordSchema.safeParse(STEP).success).toBe(true);
    expect(AgentStepRecordSchema.safeParse({ ...STEP, state: "fail" }).success).toBe(true);
  });

  it("DEV-003 AC-3: appendStep input з state \"pending\" або невідомим type → помилка", () => {
    expect(AgentStepAppendInputSchema.safeParse({ type: "tool", label: "x", state: "pending" }).success).toBe(false);
    expect(AgentStepAppendInputSchema.safeParse({ type: "prompt", label: "x", state: "done" }).success).toBe(false);
  });

  it("DEV-003 AC-3: finishRun зі статусом running → помилка", () => {
    expect(AgentRunFinishInputSchema.safeParse({ status: "running" }).success).toBe(false);
    expect(AgentRunFinishInputSchema.safeParse({ status: "result", result: { ok: true } }).success).toBe(true);
  });

  it("DEV-003 AC-3: UI-стани кроку лишились незмінними (pending|run|done|fail)", () => {
    expect(AgentStepStateSchema.options).toEqual(["pending", "run", "done", "fail"]);
  });
});
