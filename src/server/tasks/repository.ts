import "server-only";
import { and, asc, count, desc, eq, inArray, lte, max, sql } from "drizzle-orm";
import {
  getHeat, TaskListQuerySchema,
  type Note, type NoteCreateInput, type Subtask, type SubtaskCreateInput,
  type SubtaskUpdateInput, type Task, type TaskCreateInput, type TaskListItem,
  type TaskListQuery, type TaskPage, type TaskPageQuery, type TaskSummary, type TaskUpdateInput,
} from "@/entities/task";
import { NotFoundError } from "@/shared/api/errors";
import { MS_PER_DAY } from "@/shared/lib/timestamp";
import type { DevLogDb } from "../db/client";
import { createId } from "../ids";
import { notes, subtasks, tasks } from "./schema";

type TaskRow = typeof tasks.$inferSelect;

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

const normalizeDueAt = (value: string | null) => value === null ? null : new Date(value).toISOString();

export const createTaskRepository = (db: DevLogDb) => {
  const getTaskRow = (id: string): TaskRow | null =>
    db.select().from(tasks).where(eq(tasks.id, id)).get() ?? null;

  const getTask = (id: string): Task | null => {
    const task = getTaskRow(id);
    if (!task) return null;
    return {
      ...task,
      subtasks: db.select().from(subtasks).where(eq(subtasks.taskId, id))
        .orderBy(asc(subtasks.position), asc(subtasks.id)).all(),
      notes: db.select().from(notes).where(eq(notes.taskId, id))
        .orderBy(asc(notes.createdAt), asc(notes.id)).all(),
    };
  };

  const taskFilters = ({ status, q }: TaskListQuery) => and(
    status ? eq(tasks.status, status) : undefined,
    q ? sql`unicode_lower(${tasks.title} || ' ' || ${tasks.description}) like ${`%${escapeLike(q.toLowerCase())}%`} escape ${"\\"}` : undefined,
  );

  const buildTaskList = (connection: Pick<DevLogDb, "select">, { sort, order }: TaskListQuery) => {
    const direction = order === "asc" ? asc : desc;
    const priority = sql`case ${tasks.priority} when 'high' then 3 when 'medium' then 2 else 1 end`;
    const ordering = sort === "priority"
      ? [direction(priority), desc(tasks.createdAt), asc(tasks.id)]
      : [direction(tasks.createdAt), asc(tasks.id)];
    const counts = connection.select({
      taskId: subtasks.taskId,
      total: count().as("total"),
      done: sql<number>`count(case when ${subtasks.status} = 'done' then 1 end)`.as("done"),
    }).from(subtasks).groupBy(subtasks.taskId).as("subtask_counts");

    return connection.select({
      id: tasks.id, title: tasks.title, description: tasks.description,
      status: tasks.status, priority: tasks.priority, createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt, dueAt: tasks.dueAt, focusRank: tasks.focusRank,
      subtaskCount: sql<number>`coalesce(${counts.total}, 0)`,
      subtaskDone: sql<number>`coalesce(${counts.done}, 0)`,
    }).from(tasks).leftJoin(counts, eq(tasks.id, counts.taskId)).orderBy(...ordering);
  };

  const listTasks = (input: Partial<TaskListQuery> = {}): TaskListItem[] => {
    const query = TaskListQuerySchema.parse(input);
    return buildTaskList(db, query).where(taskFilters(query)).all();
  };

  const listTaskPage = (query: TaskPageQuery, now: Date): TaskPage => db.transaction((tx) => {
    const filters = taskFilters(query);
    const total = tx.select({ count: count() }).from(tasks).where(filters).get()?.count ?? 0;
    const totalPages = Math.ceil(total / query.pageSize);
    const page = Math.min(query.page, Math.max(1, totalPages));
    const data = buildTaskList(tx, query).where(filters)
      .limit(query.pageSize).offset((page - 1) * query.pageSize).all();

    const summary: TaskSummary = { all: 0, todo: 0, "in-progress": 0, done: 0, hot: 0 };
    const heatInputs = tx.select({
      status: tasks.status, priority: tasks.priority, updatedAt: tasks.updatedAt, dueAt: tasks.dueAt,
    }).from(tasks).all();
    for (const task of heatInputs) {
      summary.all++;
      summary[task.status]++;
      if (getHeat(task, now).rank >= 2) summary.hot++;
    }

    return { data, pagination: { page, pageSize: query.pageSize, total, totalPages }, summary };
  });

  const createTask = (input: TaskCreateInput, now: Date): Task => {
    const timestamp = now.toISOString();
    const row = db.insert(tasks).values({
      ...input, id: createId(), createdAt: timestamp, updatedAt: timestamp,
      dueAt: normalizeDueAt(input.dueAt ?? null),
    }).returning().get();
    return { ...row, subtasks: [], notes: [] };
  };

  const updateTask = (id: string, input: TaskUpdateInput, { now, touch }: { now: Date; touch: boolean }): Task | null =>
    db.transaction(() => {
      const { dueAt, ...fields } = input;
      const result = db.update(tasks).set({
        ...fields,
        dueAt: dueAt === undefined ? undefined : normalizeDueAt(dueAt),
        updatedAt: touch ? now.toISOString() : undefined,
      }).where(eq(tasks.id, id)).run();
      return result.changes ? getTask(id) : null;
    });

  const deleteTask = (id: string) => db.delete(tasks).where(eq(tasks.id, id)).run().changes > 0;

  const touchTask = (id: string, now: string) =>
    db.update(tasks).set({ updatedAt: now }).where(eq(tasks.id, id)).run();

  const addSubtasks = (taskId: string, items: SubtaskCreateInput[], now: Date): Subtask[] | null =>
    db.transaction(() => {
      if (!getTaskRow(taskId)) return null;
      if (!items.length) return [];
      const { last } = db.select({ last: max(subtasks.position) }).from(subtasks)
        .where(eq(subtasks.taskId, taskId)).get() ?? { last: null };
      const nowIso = now.toISOString();
      const inserted = db.insert(subtasks).values(items.map((item, index): typeof subtasks.$inferInsert => ({
        ...item, id: createId(), taskId, status: "todo",
        position: (last ?? -1) + index + 1, createdAt: nowIso,
      }))).returning().all();
      touchTask(taskId, nowIso);
      return inserted;
    }, { behavior: "immediate" });

  const updateSubtask = (taskId: string, id: string, input: SubtaskUpdateInput, now: Date): Subtask | null =>
    db.transaction(() => {
      const row = db.update(subtasks).set(input)
        .where(and(eq(subtasks.id, id), eq(subtasks.taskId, taskId))).returning().get();
      if (row) touchTask(taskId, now.toISOString());
      return row ?? null;
    });

  const deleteSubtask = (taskId: string, id: string, now: Date) =>
    db.transaction(() => {
      const result = db.delete(subtasks).where(and(eq(subtasks.id, id), eq(subtasks.taskId, taskId))).run();
      if (result.changes) touchTask(taskId, now.toISOString());
      return result.changes > 0;
    });

  const addNote = (taskId: string, input: NoteCreateInput, now: Date): Note | null =>
    db.transaction(() => {
      if (!getTaskRow(taskId)) return null;
      const timestamp = now.toISOString();
      const note = db.insert(notes).values({ ...input, taskId, id: createId(), createdAt: timestamp })
        .returning().get();
      touchTask(taskId, timestamp);
      return note;
    }, { behavior: "immediate" });

  const setFocus = (taskIds: string[]) => db.transaction(() => {
    if (new Set(taskIds).size !== taskIds.length) throw new Error("Focus task IDs must be unique");
    if (taskIds.length && db.select({ id: tasks.id }).from(tasks).where(inArray(tasks.id, taskIds)).all().length !== taskIds.length) {
      throw new NotFoundError("Focus includes an unknown task");
    }
    db.update(tasks).set({ focusRank: null }).run();
    return taskIds.map((taskId, index) => {
      const focusRank = index + 1;
      db.update(tasks).set({ focusRank }).where(eq(tasks.id, taskId)).run();
      return { taskId, focusRank };
    });
  }, { behavior: "immediate" });

  const findStale = ({ minDays, now }: { minDays: number; now: Date }): TaskRow[] =>
    db.select().from(tasks).where(and(
      eq(tasks.status, "in-progress"),
      lte(tasks.updatedAt, new Date(now.getTime() - minDays * MS_PER_DAY).toISOString()),
    )).orderBy(asc(tasks.updatedAt), asc(tasks.id)).all();

  return {
    listTasks, listTaskPage, getTask, getTaskRow, createTask, updateTask, deleteTask, addSubtasks,
    updateSubtask, deleteSubtask, addNote, setFocus, findStale,
  };
};
