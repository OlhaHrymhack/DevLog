import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getTasks, POST as createTask } from "@/app/api/tasks/route";
import { DELETE as deleteTask, GET as getTask, PATCH as updateTask } from "@/app/api/tasks/[id]/route";
import { POST as addNote } from "@/app/api/tasks/[id]/notes/route";
import {
  DELETE as deleteSubtask, PATCH as updateSubtask,
} from "@/app/api/tasks/[id]/subtasks/[subtaskId]/route";
import { POST as addSubtasks } from "@/app/api/tasks/[id]/subtasks/route";
import { PUT as setFocus } from "@/app/api/tasks/focus/route";
import { SubtaskSchema, TaskPageSchema, TaskSchema } from "@/entities/task";
import { createDb, getDb } from "@/server/db/client";
import { seedDatabase } from "@/server/db/seed";
import { logger } from "@/server/logger";
import { createTaskRepository } from "@/server/tasks/repository";
import { z } from "zod";

vi.mock(import("@/server/db/client"), async (importOriginal) => ({
  ...await importOriginal(),
  getDb: vi.fn(),
}));

const request = (method: string, path = "", body?: unknown) =>
  new Request(`http://localhost/api/tasks${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const params = <T extends Record<string, string>>(values: T) => ({ params: Promise.resolve(values) });

const NOW = new Date("2026-11-21T12:00:00Z");
const BODY = { title: "Зберегти задачу", description: "Задача лишається в SQLite." };
const taskData = z.object({ data: TaskSchema });
const subtasksData = z.object({ data: z.array(SubtaskSchema) });

describe("REST tasks", () => {
  let connection: ReturnType<typeof createDb>;

  beforeEach(() => {
    connection = createDb(":memory:");
    seedDatabase(connection.db, NOW);
    vi.mocked(getDb).mockReturnValue(connection);
    vi.spyOn(logger, "info").mockImplementation(() => undefined);
    vi.spyOn(logger, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    connection.close();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("DEV-004 AC-1: creates a task with defaults and rejects malformed input", async () => {
    const response = await createTask(request("POST", "", BODY));
    expect(response.status).toBe(201);
    const { data } = taskData.parse(await response.json());
    expect(data).toMatchObject({ ...BODY, status: "todo", priority: "medium" });
    expect(data.updatedAt).toBe(data.createdAt);

    const missing = await createTask(request("POST", "", { description: BODY.description }));
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR", details: { fieldErrors: { title: expect.any(Array) } } },
    });

    for (const extra of [{ status: "blocked" }, { createdAt: NOW.toISOString() }]) {
      expect((await createTask(request("POST", "", { ...BODY, ...extra }))).status).toBe(400);
    }
    const broken = await createTask(new Request("http://localhost/api/tasks", { method: "POST", body: "{" }));
    expect(await broken.json()).toEqual({ error: { code: "VALIDATION_ERROR", message: "Невалідний JSON" } });
    expect(broken.status).toBe(400);
  });

  it("DEV-004 AC-2: lists counts, returns details, and handles missing IDs", async () => {
    const response = await getTasks(request("GET"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(12);
    expect(body.data).toContainEqual(expect.objectContaining({ id: "t9", subtaskCount: 3, subtaskDone: 1 }));
    expect(body.data[0]).not.toHaveProperty("notes");

    const details = await getTask(request("GET", "/t1"), params({ id: "t1" }));
    const { data } = taskData.parse(await details.json());
    expect(data.subtasks).toHaveLength(2);
    expect(data.notes).toHaveLength(1);
    const missing = await getTask(request("GET", "/missing"), params({ id: "missing" }));
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("DEV-004 AC-3: updates a task without changing createdAt and rejects invalid updates", async () => {
    const before = createTaskRepository(connection.db).getTask("t1");
    const response = await updateTask(request("PATCH", "/t1", { status: "done" }), params({ id: "t1" }));
    expect(response.status).toBe(200);
    const { data } = taskData.parse(await response.json());
    expect(data.status).toBe("done");
    expect(data.updatedAt).not.toBe(before?.updatedAt);
    expect(data.createdAt).toBe(before?.createdAt);
    expect((await updateTask(request("PATCH", "/t1", {}), params({ id: "t1" }))).status).toBe(400);
    expect((await updateTask(request("PATCH", "/missing", { status: "done" }), params({ id: "missing" }))).status).toBe(404);
  });

  it("DEV-004 AC-4: deletion returns empty 204 and removes dependent rows", async () => {
    const context = params({ id: "t1" });
    const response = await deleteTask(request("DELETE", "/t1"), context);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect((await getTask(request("GET", "/t1"), context)).status).toBe(404);
    expect(connection.sqlite.prepare("select count(*) from subtasks where task_id = ?").pluck().get("t1")).toBe(0);
    expect((await deleteTask(request("DELETE", "/t1"), context)).status).toBe(404);
  });

  it("DEV-004 AC-5: filters, sorts, searches and rejects unknown query parameters", async () => {
    const ask = async (query: string) => (await getTasks(request("GET", `?${query}`))).json();
    const item = z.object({ id: z.string(), priority: z.string() });
    const parseItems = (body: unknown) => z.object({ data: z.array(item) }).parse(body).data;
    const ids = (body: unknown) => parseItems(body).map(({ id }) => id);
    expect(new Set(ids(await ask("status=in-progress")))).toEqual(new Set(["t1", "t3", "t9", "t12"]));
    expect(parseItems(await ask("sort=priority&order=desc")).map(({ priority }) => priority)).toEqual([
      "high", "high", "high", "high", "medium", "medium", "medium", "medium", "medium", "low", "low", "low",
    ]);
    expect(ids(await ask("sort=createdAt&order=asc"))[0]).toBe("t10");
    expect(ids(await ask("q=OOM"))).toEqual(["t1"]);
    for (const query of ["status=foo", "sort=bar", "unknown=x"]) {
      expect((await getTasks(request("GET", `?${query}`))).status).toBe(400);
    }
  });

  it("DEV-005 AC-13: returns a stable page with filtered totals and global counters", async () => {
    const getPage = async (query: string) => {
      const response = await getTasks(request("GET", `?${query}`));
      expect(response.status).toBe(200);
      return TaskPageSchema.parse(await response.json());
    };

    const first = await getPage("page=1");
    const last = await getPage("page=2");
    const unpaginated = z.object({ data: z.array(z.object({ id: z.string() })) })
      .parse(await (await getTasks(request("GET"))).json());
    expect([...first.data, ...last.data].map(({ id }) => id)).toEqual(unpaginated.data.map(({ id }) => id));
    expect(first.data).toHaveLength(10);
    expect(last.data).toHaveLength(2);
    expect(last.pagination).toEqual({ page: 2, pageSize: 10, total: 12, totalPages: 2 });
    expect(last.summary).toEqual(first.summary);
    expect(last.summary).toMatchObject({ all: 12, todo: 6, "in-progress": 4, done: 2 });

    const filtered = await getPage("page=2&pageSize=2&status=in-progress&sort=createdAt&order=asc");
    expect(filtered.data).toHaveLength(2);
    expect(filtered.data.every(({ status }) => status === "in-progress")).toBe(true);
    expect(filtered.pagination).toEqual({ page: 2, pageSize: 2, total: 4, totalPages: 2 });
    expect(filtered.summary).toEqual(first.summary);

    const searched = await getPage("page=9&pageSize=1&status=in-progress&q=OOM");
    expect(searched.data.map(({ id }) => id)).toEqual(["t1"]);
    expect(searched.pagination).toEqual({ page: 1, pageSize: 1, total: 1, totalPages: 1 });
    const empty = await getPage("page=9&q=no-such-task");
    expect(empty.data).toEqual([]);
    expect(empty.pagination).toEqual({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
  });

  it("DEV-005 AC-13: validates page parameters before querying", async () => {
    for (const query of ["page=0", "page=-1", "page=1.5", "page=9007199254740992", "pageSize=", "pageSize=101", "page=1&unknown=x"]) {
      const response = await getTasks(request("GET", `?${query}`));
      expect(response.status).toBe(400);
    }
    expect(getDb).not.toHaveBeenCalled();
  });

  it("DEV-004 AC-6: manages subtasks and notes and rejects a subtask of another task", async () => {
    const before = createTaskRepository(connection.db).getTask("t1");
    const context = params({ id: "t1" });
    const items = ["Перша", "Друга", "Третя"].map((title) => ({ title, source: "ai", estimate: "1 год" }));
    const response = await addSubtasks(request("POST", "/t1/subtasks", { items }), context);
    expect(response.status).toBe(201);
    const { data } = subtasksData.parse(await response.json());
    expect(data).toHaveLength(3);
    expect(data[0]).toMatchObject({ source: "ai", estimate: "1 год" });
    expect(createTaskRepository(connection.db).getTask("t1")?.updatedAt).not.toBe(before?.updatedAt);
    expect((await addSubtasks(request("POST", "/t1/subtasks", { items: Array.from({ length: 7 }, () => items[0]) }), context)).status).toBe(400);
    const subtaskId = data[0]?.id;
    if (!subtaskId) throw new Error("Expected a created subtask");
    const nestedPath = `/subtasks/${subtaskId}`;
    expect((await updateSubtask(request("PATCH", `/t2${nestedPath}`, { status: "done" }), params({ id: "t2", subtaskId }))).status).toBe(404);
    const subtaskContext = params({ id: "t1", subtaskId });
    expect((await updateSubtask(request("PATCH", `/t1${nestedPath}`, { status: "done" }), subtaskContext)).status).toBe(200);
    expect((await deleteSubtask(request("DELETE", `/t1${nestedPath}`), subtaskContext)).status).toBe(204);
    expect((await addNote(request("POST", "/t1/notes", { text: "  " }), context)).status).toBe(400);
    expect((await addNote(request("POST", "/t1/notes", { text: "Завершено рев’ю" }), context)).status).toBe(201);
  });

  it("DEV-004 AC-7: sets focus atomically and accepts an empty list to clear it", async () => {
    const put = (taskIds: string[]) => setFocus(request("PUT", "/focus", { taskIds }));
    const response = await put(["t2", "t7", "t1"]);
    expect(await response.json()).toEqual({ data: [
      { taskId: "t2", focusRank: 1 }, { taskId: "t7", focusRank: 2 }, { taskId: "t1", focusRank: 3 },
    ] });
    expect((await put(["missing"])).status).toBe(404);
    expect((await put(["t1", "t1"])).status).toBe(400);
    expect((await put(["t1", "t2", "t3", "t4"])).status).toBe(400);
    expect(createTaskRepository(connection.db).getTask("t2")?.focusRank).toBe(1);
    expect(await (await put([])).json()).toEqual({ data: [] });
    expect(createTaskRepository(connection.db).listTasks().every((task) => task.focusRank === null)).toBe(true);
  });

  it("DEV-004 AC-8: returns a generic 500 and logs request metadata without the query", async () => {
    vi.mocked(getDb).mockImplementationOnce(() => { throw new Error("internal-marker"); });
    const response = await getTasks(request("GET", "?q=private-marker"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Внутрішня помилка сервера" },
    });
    expect(logger.info).toHaveBeenCalledWith({
      method: "GET", path: "/api/tasks", status: 500, durationMs: expect.any(Number),
      requestId: response.headers.get("x-request-id"),
    }, "Request completed");
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain("internal-marker");
  });
});
