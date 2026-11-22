import { expect, test } from "vitest";
import { getHeat, HEAT_ORDER } from "@/entities/task";
import { createTaskRepository } from "../tasks/repository";
import { createDb } from "./client";
import { seedDatabase } from "./seed";

test("DEV-003 AC-9: seed covers all heat levels and replaces fixtures without duplicates", () => {
  const connection = createDb(":memory:");
  const now = new Date("2026-11-21T12:00:00Z");
  try {
    const repository = createTaskRepository(connection.db);
    expect(seedDatabase(connection.db, now)).toBe(12);
    const run = repository.createRun({ kind: "prioritize", mode: "demo", taskId: "t1" }, now);
    repository.appendStep(run.id, { type: "model", label: "Plan", state: "done" }, now);
    expect(seedDatabase(connection.db, now)).toBe(12);
    const seeded = repository.listTasks();
    expect(seeded).toHaveLength(12);
    expect(new Set(seeded.map((task) => getHeat(task, now).key))).toEqual(new Set(HEAT_ORDER));
    expect(Object.fromEntries(seeded.map((task) => [task.id, getHeat(task, now).key]))).toEqual({
      t1: "hot", t2: "alarm", t3: "warm", t4: "fresh", t5: "calm", t6: "done",
      t7: "fire", t8: "warm", t9: "fresh", t10: "calm", t11: "done", t12: "warm",
    });
    for (const [id, count] of Object.entries({ t1: 2, t6: 2, t9: 3, t12: 4 })) {
      expect(repository.getTask(id)?.subtasks).toHaveLength(count);
    }
    for (const id of ["t1", "t6", "t9"]) expect(repository.getTask(id)?.notes).toHaveLength(1);
    expect(connection.sqlite.prepare("select count(*) from agent_runs").pluck().get()).toBe(0);
    expect(repository.listRunSteps(run.id)).toEqual([]);
  } finally {
    connection.close();
  }
});
