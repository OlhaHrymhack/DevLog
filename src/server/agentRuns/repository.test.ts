import { expect, test } from "vitest";
import { createDb } from "../db/client";
import { createAgentRunRepository } from "./repository";

const NOW = new Date("2026-11-21T12:00:00Z");

test("DEV-003 AC-10: agent traces keep step order, JSON payloads, and completion status", async () => {
  const connection = await createDb(":memory:");
  const repository = createAgentRunRepository(connection.db);
  try {
    const run = await repository.createRun({ kind: "prioritize", mode: "demo" }, NOW);
    expect(run).toMatchObject({ status: "running", finishedAt: null, taskId: null });
    await repository.appendStep(run.id, { type: "model", label: "Plan", state: "done", payload: { round: 1 } }, NOW);
    await repository.appendStep(run.id, { type: "tool", label: "Load tasks", state: "fail", detail: "No tasks" }, NOW);
    await repository.appendStep(run.id, { type: "validation", label: "Validate", state: "done" }, NOW);
    const result = { taskIds: ["t1"] };
    expect(await repository.finishRun(run.id, { status: "result", result }, NOW))
      .toMatchObject({ status: "result", finishedAt: NOW.toISOString(), result });
    expect((await repository.listRunSteps(run.id)).map((step) => step.index)).toEqual([0, 1, 2]);
    expect((await repository.listRunSteps(run.id))[0]?.payload).toEqual({ round: 1 });
  } finally {
    connection.close();
  }
});

test("DEV-017 AC-3: parallel steps of one run get unique sequential indexes inside one transaction", async () => {
  const connection = await createDb(":memory:");
  const repository = createAgentRunRepository(connection.db);
  try {
    const run = await repository.createRun({ kind: "decompose", mode: "demo" }, NOW);
    await Promise.all(Array.from({ length: 15 }, (_, index) =>
      repository.appendStep(run.id, { type: "tool", label: `Step ${index}`, state: "done" }, NOW)));
    expect((await repository.listRunSteps(run.id)).map((step) => step.index)).toEqual(Array.from({ length: 15 }, (_, index) => index));
  } finally {
    connection.close();
  }
});
