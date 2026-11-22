import { expect, test } from "vitest";
import { createDb } from "../db/client";
import { createAgentRunRepository } from "./repository";

const NOW = new Date("2026-11-21T12:00:00Z");

test("DEV-003 AC-10: agent traces keep step order, JSON payloads, and completion status", () => {
  const connection = createDb(":memory:");
  const repository = createAgentRunRepository(connection.db);
  try {
    const run = repository.createRun({ kind: "prioritize", mode: "demo" }, NOW);
    expect(run).toMatchObject({ status: "running", finishedAt: null, taskId: null });
    repository.appendStep(run.id, { type: "model", label: "Plan", state: "done", payload: { round: 1 } }, NOW);
    repository.appendStep(run.id, { type: "tool", label: "Load tasks", state: "fail", detail: "No tasks" }, NOW);
    repository.appendStep(run.id, { type: "validation", label: "Validate", state: "done" }, NOW);
    const result = { taskIds: ["t1"] };
    expect(repository.finishRun(run.id, { status: "result", result }, NOW))
      .toMatchObject({ status: "result", finishedAt: NOW.toISOString(), result });
    expect(repository.listRunSteps(run.id).map((step) => step.index)).toEqual([0, 1, 2]);
    expect(repository.listRunSteps(run.id)[0]?.payload).toEqual({ round: 1 });
  } finally {
    connection.close();
  }
});
