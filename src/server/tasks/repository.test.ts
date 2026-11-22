import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { TaskCreateInputSchema } from "@/entities/task";
import { createDb } from "../db/client";
import { seedDatabase } from "../db/seed";
import { createTaskRepository } from "./repository";

const NOW = new Date("2026-11-21T12:00:00Z");

let connection: ReturnType<typeof createDb>;
let repository: ReturnType<typeof createTaskRepository>;

beforeEach(() => {
  connection = createDb(":memory:");
  repository = createTaskRepository(connection.db);
  seedDatabase(connection.db, NOW);
});

afterEach(() => connection.close());

test("DEV-003 AC-2: task creation, updates and deletion persist across connections", () => {
  const dir = mkdtempSync(join(tmpdir(), "devlog-repo-test-"));
  const file = join(dir, "tasks.db");
  const withDb = <T,>(run: (repo: typeof repository) => T): T => {
    const opened = createDb(file);
    try {
      return run(createTaskRepository(opened.db));
    } finally {
      opened.close();
    }
  };

  try {
    const input = TaskCreateInputSchema.parse({
      title: "Persist a task", description: "Keep this task after reopening.", dueAt: "2026-11-22T14:00:00+02:00",
    });
    const created = withDb((repo) => repo.createTask(input, NOW));
    expect(created.dueAt).toBe("2026-11-22T12:00:00.000Z");
    expect(withDb((repo) => repo.getTask(created.id))).toEqual(created);
    withDb((repo) => repo.updateTask(created.id, { status: "done", dueAt: null }, { now: NOW, touch: true }));
    expect(withDb((repo) => repo.getTask(created.id))).toMatchObject({ status: "done", dueAt: null });
    expect(withDb((repo) => repo.deleteTask(created.id))).toBe(true);
    expect(withDb((repo) => repo.getTask(created.id))).toBeNull();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("DEV-003 AC-5: priority and date sorting are stable; search handles Unicode and LIKE wildcards", () => {
  const ids = (rows: ReturnType<typeof repository.listTasks>) => rows.map((row) => row.id);
  expect(ids(repository.listTasks())).toEqual(["t9", "t1", "t7", "t2", "t4", "t8", "t3", "t12", "t6", "t5", "t11", "t10"]);
  expect(ids(repository.listTasks({ order: "asc" }))).toEqual(["t5", "t11", "t10", "t4", "t8", "t3", "t12", "t6", "t9", "t1", "t7", "t2"]);
  expect(repository.listTasks({ sort: "createdAt" })[0]?.id).toBe("t5");
  expect(repository.listTasks({ sort: "createdAt", order: "asc" })[0]?.id).toBe("t10");
  expect(new Set(ids(repository.listTasks({ status: "in-progress" })))).toEqual(new Set(["t1", "t3", "t9", "t12"]));
  for (const q of ["пам", "ПАМ", "OOM"]) expect(ids(repository.listTasks({ q }))).toEqual(["t1"]);
  for (const q of ["%", "_", "\\"]) expect(repository.listTasks({ q })).toEqual([]);
  expect(repository.listTasks({ q: "  " })).toHaveLength(12);
  expect(repository.listTasks().find((row) => row.id === "t9")).toMatchObject({ subtaskCount: 3, subtaskDone: 1 });
});

test("DEV-003 AC-6: deleting a task cascades to subtasks and notes and preserves run history", () => {
  const run = repository.createRun({ kind: "status-update", mode: "demo", taskId: "t1" }, NOW);
  expect(repository.deleteTask("t1")).toBe(true);
  expect(repository.getTask("t1")).toBeNull();
  expect(repository.listTasks()).toHaveLength(11);
  for (const table of ["subtasks", "notes"]) {
    expect(connection.sqlite.prepare(`select count(*) from ${table} where task_id = ?`).pluck().get("t1")).toBe(0);
  }
  expect(repository.finishRun(run.id, { status: "result" }, NOW)?.taskId).toBeNull();
});

test("DEV-003 AC-7: focus is replaced atomically, including on invalid input", () => {
  const focus = () => Object.fromEntries(repository.listTasks()
    .filter((task) => task.focusRank !== null).map((task) => [task.id, task.focusRank]));
  repository.setFocus(["t2", "t7", "t1"]);
  expect(focus()).toEqual({ t2: 1, t7: 2, t1: 3 });
  expect(() => repository.setFocus(["t1", "missing"])).toThrow(/unknown/);
  expect(focus()).toEqual({ t2: 1, t7: 2, t1: 3 });
  repository.setFocus(["t9"]);
  expect(focus()).toEqual({ t9: 1 });
});

test("DEV-003 AC-8: stale tasks are in progress and include the exact age boundary", () => {
  expect(repository.findStale({ minDays: 3, now: NOW }).map((task) => task.id)).toEqual(["t12", "t1", "t3"]);
  const task = repository.createTask(
    TaskCreateInputSchema.parse({ title: "Boundary", description: "Exactly three days.", status: "in-progress" }),
    new Date("2026-11-18T12:00:00Z"),
  );
  expect(repository.findStale({ minDays: 3, now: NOW }).at(-1)?.id).toBe(task.id);
});

test("DEV-003 AC-10: agent traces keep step order, JSON payloads, and completion status", () => {
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
});
