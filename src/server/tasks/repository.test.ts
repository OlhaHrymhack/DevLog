import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { TaskCreateInputSchema } from "@/entities/task";
import { createAgentRunRepository } from "../agentRuns/repository";
import { createDb, type DbConnection } from "../db/client";
import { seedDatabase } from "../db/seed";
import { createTaskRepository } from "./repository";

const NOW = new Date("2026-11-21T12:00:00Z");

let connection: DbConnection;
let repository: ReturnType<typeof createTaskRepository>;

beforeEach(async () => {
  connection = await createDb(":memory:");
  repository = createTaskRepository(connection.db);
  await seedDatabase(connection.db, NOW);
});

afterEach(() => connection.close());

const countWhere = async (table: string, taskId: string) =>
  Number((await connection.client.execute({ sql: `select count(*) as n from ${table} where task_id = ?`, args: [taskId] })).rows[0]?.n);

test("DEV-003 AC-2: task creation, updates and deletion persist across connections", async () => {
  const dir = mkdtempSync(join(tmpdir(), "devlog-repo-test-"));
  const file = join(dir, "tasks.db");
  const withDb = async <T,>(run: (repo: typeof repository) => Promise<T>): Promise<T> => {
    const opened = await createDb(file);
    try {
      return await run(createTaskRepository(opened.db));
    } finally {
      opened.close();
    }
  };

  try {
    const input = TaskCreateInputSchema.parse({
      title: "Persist a task", description: "Keep this task after reopening.", dueAt: "2026-11-22T14:00:00+02:00",
    });
    const created = await withDb((repo) => repo.createTask(input, NOW));
    expect(created.dueAt).toBe("2026-11-22T12:00:00.000Z");
    expect(created).not.toHaveProperty("searchText");
    expect(await withDb((repo) => repo.getTask(created.id))).toEqual(created);
    await withDb((repo) => repo.updateTask(created.id, { status: "done", dueAt: null }, { now: NOW, touch: true }));
    expect(await withDb((repo) => repo.getTask(created.id))).toMatchObject({ status: "done", dueAt: null });
    expect(await withDb((repo) => repo.deleteTask(created.id))).toBe(true);
    expect(await withDb((repo) => repo.getTask(created.id))).toBeNull();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("DEV-003 AC-5: priority and date sorting are stable; search handles Unicode and LIKE wildcards", async () => {
  const ids = (rows: Awaited<ReturnType<typeof repository.listTasks>>) => rows.map((row) => row.id);
  expect(ids(await repository.listTasks())).toEqual(["t9", "t1", "t7", "t2", "t4", "t8", "t3", "t12", "t6", "t5", "t11", "t10"]);
  expect(ids(await repository.listTasks({ order: "asc" }))).toEqual(["t5", "t11", "t10", "t4", "t8", "t3", "t12", "t6", "t9", "t1", "t7", "t2"]);
  expect((await repository.listTasks({ sort: "createdAt" }))[0]?.id).toBe("t5");
  expect((await repository.listTasks({ sort: "createdAt", order: "asc" }))[0]?.id).toBe("t10");
  expect(new Set(ids(await repository.listTasks({ status: "in-progress" })))).toEqual(new Set(["t1", "t3", "t9", "t12"]));
  for (const q of ["пам", "ПАМ", "OOM"]) expect(ids(await repository.listTasks({ q }))).toEqual(["t1"]);
  for (const q of ["%", "_", "\\"]) expect(await repository.listTasks({ q })).toEqual([]);
  expect(await repository.listTasks({ q: "  " })).toHaveLength(12);
  expect((await repository.listTasks()).find((row) => row.id === "t9")).toMatchObject({ subtaskCount: 3, subtaskDone: 1 });
});

test("DEV-017 AC-3: search text follows title/description edits, matches literal wildcards and paginates on the server", async () => {
  const created = await repository.createTask(TaskCreateInputSchema.parse({ title: "Знижка 50% для_всіх", description: "Шлях C:\\temp" }), NOW);
  expect((await repository.listTasks({ q: "50%" })).map((task) => task.id)).toEqual([created.id]);
  expect((await repository.listTasks({ q: "для_ВСІХ" })).map((task) => task.id)).toEqual([created.id]);
  expect((await repository.listTasks({ q: "c:\\TEMP" })).map((task) => task.id)).toEqual([created.id]);
  expect(await repository.listTasks({ q: "50_" })).toEqual([]);

  await repository.updateTask(created.id, { title: "Ґанок і Їжак" }, { now: NOW, touch: true });
  expect((await repository.listTasks({ q: "ґАНОК" })).map((task) => task.id)).toEqual([created.id]);
  expect((await repository.listTasks({ q: "c:\\temp" })).map((task) => task.id)).toEqual([created.id]);
  expect(await repository.listTasks({ q: "50%" })).toEqual([]);

  const page = await repository.listTaskPage({ page: 2, pageSize: 5, sort: "priority", order: "desc", q: "" }, NOW);
  expect(page.pagination).toEqual({ page: 2, pageSize: 5, total: 13, totalPages: 3 });
  expect(page.data).toHaveLength(5);
  const filtered = await repository.listTaskPage({ page: 1, pageSize: 5, sort: "priority", order: "desc", q: "ПАМ" }, NOW);
  expect(filtered.data.map((task) => task.id)).toEqual(["t1"]);
  expect(filtered.summary.all).toBe(13);
});

test("DEV-003 AC-6: deleting a task cascades to subtasks and notes and preserves run history", async () => {
  const agentRuns = createAgentRunRepository(connection.db);
  const run = await agentRuns.createRun({ kind: "status-update", mode: "demo", taskId: "t1" }, NOW);
  expect(await countWhere("subtasks", "t1")).toBeGreaterThan(0);
  expect(await repository.deleteTask("t1")).toBe(true);
  expect(await repository.getTask("t1")).toBeNull();
  expect(await repository.listTasks()).toHaveLength(11);
  for (const table of ["subtasks", "notes"]) expect(await countWhere(table, "t1")).toBe(0);
  expect((await agentRuns.finishRun(run.id, { status: "result" }, NOW))?.taskId).toBeNull();
});

test("DEV-003 AC-7: focus is replaced atomically, including on invalid input", async () => {
  const focus = async () => Object.fromEntries((await repository.listTasks())
    .filter((task) => task.focusRank !== null).map((task) => [task.id, task.focusRank]));
  await repository.setFocus(["t2", "t7", "t1"]);
  expect(await focus()).toEqual({ t2: 1, t7: 2, t1: 3 });
  await expect(repository.setFocus(["t1", "missing"])).rejects.toThrow(/unknown/);
  expect(await focus()).toEqual({ t2: 1, t7: 2, t1: 3 });
  await repository.setFocus(["t9"]);
  expect(await focus()).toEqual({ t9: 1 });
});

test("DEV-017 AC-3: concurrent writes on a local file keep transactions atomic (focus, subtask positions)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "devlog-repo-tx-"));
  const file = join(dir, "tx.db");
  const first = await createDb(file);
  const second = await createDb(file);
  try {
    await seedDatabase(first.db, NOW);
    const a = createTaskRepository(first.db);
    const b = createTaskRepository(second.db);
    const batches = Array.from({ length: 12 }, (_, index) => (index % 2 ? a : b)
      .addSubtasks("t5", [{ title: `Пункт ${index}-1`, source: "user" }, { title: `Пункт ${index}-2`, source: "user" }], NOW));
    const focuses = [["t1", "t2"], ["t3"], ["t7", "t9", "t12"]].map((ids, index) => (index % 2 ? a : b).setFocus(ids));
    await Promise.all([...batches, ...focuses, a.setFocus(["t1", "ghost"]).catch(() => "rejected")]);

    const positions = (await b.getTask("t5"))?.subtasks.map((subtask) => subtask.position) ?? [];
    expect(positions).toEqual(Array.from({ length: 24 }, (_, index) => index));
    const ranks = (await a.listTasks()).filter((task) => task.focusRank !== null).map((task) => task.focusRank).sort();
    expect([[1, 2], [1], [1, 2, 3]]).toContainEqual(ranks);
  } finally {
    first.close();
    second.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("DEV-003 AC-8: stale tasks are in progress and include the exact age boundary", async () => {
  expect((await repository.findStale({ minDays: 3, now: NOW })).map((task) => task.id)).toEqual(["t12", "t1", "t3"]);
  const task = await repository.createTask(
    TaskCreateInputSchema.parse({ title: "Boundary", description: "Exactly three days.", status: "in-progress" }),
    new Date("2026-11-18T12:00:00Z"),
  );
  expect((await repository.findStale({ minDays: 3, now: NOW })).at(-1)?.id).toBe(task.id);
});
