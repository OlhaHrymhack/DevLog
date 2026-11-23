import { expect, test } from "vitest";
import { getHeat, HEAT_ORDER } from "@/entities/task";
import { createAgentQuotaRepository } from "../../agentQuota/repository";
import { createAgentRunRepository } from "../../agentRuns/repository";
import { createTaskRepository } from "../../tasks/repository";
import { createDb } from "../client";
import { seedDatabase, seedIfEmpty } from "./index";

test("DEV-003 AC-9: seed covers all heat levels and replaces fixtures without duplicates", async () => {
  const connection = await createDb(":memory:");
  const now = new Date("2026-11-21T12:00:00Z");
  try {
    const repository = createTaskRepository(connection.db);
    const agentRuns = createAgentRunRepository(connection.db);
    expect(await seedDatabase(connection.db, now)).toBe(12);
    const run = await agentRuns.createRun({ kind: "prioritize", mode: "demo", taskId: "t1" }, now);
    await agentRuns.appendStep(run.id, { type: "model", label: "Plan", state: "done" }, now);
    expect(await seedDatabase(connection.db, now)).toBe(12);
    const seeded = await repository.listTasks();
    expect(seeded).toHaveLength(12);
    expect(new Set(seeded.map((task) => getHeat(task, now).key))).toEqual(new Set(HEAT_ORDER));
    expect(Object.fromEntries(seeded.map((task) => [task.id, getHeat(task, now).key]))).toEqual({
      t1: "hot", t2: "alarm", t3: "warm", t4: "fresh", t5: "calm", t6: "done",
      t7: "fire", t8: "warm", t9: "fresh", t10: "calm", t11: "done", t12: "warm",
    });
    for (const [id, count] of Object.entries({ t1: 2, t6: 2, t9: 3, t12: 4 })) {
      expect((await repository.getTask(id))?.subtasks).toHaveLength(count);
    }
    for (const id of ["t1", "t6", "t9"]) expect((await repository.getTask(id))?.notes).toHaveLength(1);
    expect(Number((await connection.client.execute("select count(*) as n from agent_runs")).rows[0]?.n)).toBe(0);
    expect(await agentRuns.listRunSteps(run.id)).toEqual([]);
  } finally {
    connection.close();
  }
});

test("DEV-017 AC-3: one-time remote seed fills only an empty database and never resets tasks or quotas", async () => {
  const connection = await createDb(":memory:");
  const now = new Date("2026-11-21T12:00:00Z");
  try {
    const repository = createTaskRepository(connection.db);
    const quota = createAgentQuotaRepository(connection.db);
    expect(await seedIfEmpty(connection.db, now)).toBe(12);
    const visitorTask = await repository.createTask({ title: "Задача відвідувача", description: "Лишається після deploy", status: "todo", priority: "low" }, now);
    await quota.reserve("prioritize");
    await quota.reserve("prioritize");

    expect(await seedIfEmpty(connection.db, now)).toBe(0);
    expect(await repository.listTasks()).toHaveLength(13);
    expect(await repository.getTask(visitorTask.id)).not.toBeNull();
    expect(await quota.getUsage("prioritize")).toBe(2);

    await seedDatabase(connection.db, now);
    expect(await quota.getUsage("prioritize")).toBe(2);
  } finally {
    connection.close();
  }
});
