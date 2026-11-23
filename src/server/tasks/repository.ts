import "server-only";
import { and, asc, count, desc, eq, inArray, isNotNull, lte, max, sql } from "drizzle-orm";
import {
  getHeat, TaskListQuerySchema,
  type Note, type NoteCreateInput, type Subtask, type SubtaskCreateInput,
  type SubtaskUpdateInput, type Task, type TaskCreateInput, type TaskListItem,
  type TaskListQuery, type TaskPage, type TaskPageQuery, type TaskSummary, type TaskUpdateInput,
} from "@/entities/task";
import { NotFoundError } from "@/shared/api/errors";
import { MS_PER_DAY } from "@/shared/lib/timestamp";
import type { DbExecutor } from "../db/client";
import { createId } from "../ids";
import { notes, subtasks, tasks } from "./schema";
import { toSearchText } from "./searchText";

/** Публічні колонки задачі: службова `search_text` в API не потрапляє. */
const TASK_COLUMNS = {
  id: tasks.id, title: tasks.title, description: tasks.description,
  status: tasks.status, priority: tasks.priority, createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt, dueAt: tasks.dueAt, focusRank: tasks.focusRank,
};

export type TaskRow = Omit<typeof tasks.$inferSelect, "searchText">;

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

const normalizeDueAt = (value: string | null) => value === null ? null : new Date(value).toISOString();

/** Усі задачі з підзадачами й нотатками на один момент (одна транзакція). */
export type TaskSnapshot = { list: TaskListItem[]; tasks: Task[] };

export const createTaskRepository = (db: DbExecutor) => {
  const getTaskRow = async (id: string, connection: DbExecutor = db): Promise<TaskRow | null> =>
    await connection.select(TASK_COLUMNS).from(tasks).where(eq(tasks.id, id)).get() ?? null;

  const getTaskWith = async (connection: DbExecutor, id: string): Promise<Task | null> => {
    const task = await getTaskRow(id, connection);
    if (!task) return null;
    return {
      ...task,
      subtasks: await connection.select().from(subtasks).where(eq(subtasks.taskId, id))
        .orderBy(asc(subtasks.position), asc(subtasks.id)).all(),
      notes: await connection.select().from(notes).where(eq(notes.taskId, id))
        .orderBy(asc(notes.createdAt), asc(notes.id)).all(),
    };
  };

  const getTask = (id: string): Promise<Task | null> => db.transaction((tx) => getTaskWith(tx, id));

  const taskFilters = ({ status, q }: TaskListQuery) => and(
    status ? eq(tasks.status, status) : undefined,
    q ? sql`${tasks.searchText} like ${`%${escapeLike(q.toLowerCase())}%`} escape ${"\\"}` : undefined,
  );

  const buildTaskList = (connection: DbExecutor, { sort, order }: TaskListQuery) => {
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
      ...TASK_COLUMNS,
      subtaskCount: sql<number>`coalesce(${counts.total}, 0)`,
      subtaskDone: sql<number>`coalesce(${counts.done}, 0)`,
    }).from(tasks).leftJoin(counts, eq(tasks.id, counts.taskId)).orderBy(...ordering);
  };

  const listTasksWith = (connection: DbExecutor, query: TaskListQuery): Promise<TaskListItem[]> =>
    buildTaskList(connection, query).where(taskFilters(query)).all();

  const listTasks = (input: Partial<TaskListQuery> = {}): Promise<TaskListItem[]> =>
    listTasksWith(db, TaskListQuerySchema.parse(input));

  const listTaskPage = (query: TaskPageQuery, now: Date): Promise<TaskPage> => db.transaction(async (tx) => {
    const filters = taskFilters(query);
    const total = (await tx.select({ count: count() }).from(tasks).where(filters).get())?.count ?? 0;
    const totalPages = Math.ceil(total / query.pageSize);
    const page = Math.min(query.page, Math.max(1, totalPages));
    const data = await buildTaskList(tx, query).where(filters)
      .limit(query.pageSize).offset((page - 1) * query.pageSize).all();

    const summary: TaskSummary = { all: 0, todo: 0, "in-progress": 0, done: 0, hot: 0 };
    const heatInputs = await tx.select({
      status: tasks.status, priority: tasks.priority, updatedAt: tasks.updatedAt, dueAt: tasks.dueAt,
    }).from(tasks).all();
    for (const task of heatInputs) {
      summary.all++;
      summary[task.status]++;
      if (getHeat(task, now).rank >= 2) summary.hot++;
    }

    return { data, pagination: { page, pageSize: query.pageSize, total, totalPages }, summary };
  });

  /** Знімок для агентів: список у порядку за замовчуванням і повні задачі, прочитані в одній транзакції. */
  const readSnapshot = (): Promise<TaskSnapshot> => db.transaction(async (tx) => {
    const list = await listTasksWith(tx, TaskListQuerySchema.parse({}));
    const rows = await tx.select(TASK_COLUMNS).from(tasks).all();
    const allSubtasks = await tx.select().from(subtasks).orderBy(asc(subtasks.position), asc(subtasks.id)).all();
    const allNotes = await tx.select().from(notes).orderBy(asc(notes.createdAt), asc(notes.id)).all();
    return {
      list,
      tasks: rows.map((row) => ({
        ...row,
        subtasks: allSubtasks.filter((subtask) => subtask.taskId === row.id),
        notes: allNotes.filter((note) => note.taskId === row.id),
      })),
    };
  });

  const createTask = async (input: TaskCreateInput, now: Date): Promise<Task> => {
    const timestamp = now.toISOString();
    const row = await db.insert(tasks).values({
      ...input, id: createId(), createdAt: timestamp, updatedAt: timestamp,
      dueAt: normalizeDueAt(input.dueAt ?? null),
      searchText: toSearchText(input.title, input.description),
    }).returning(TASK_COLUMNS).get();
    return { ...row, subtasks: [], notes: [] };
  };

  const updateTask = (id: string, input: TaskUpdateInput, { now, touch }: { now: Date; touch: boolean }): Promise<Task | null> =>
    db.transaction(async (tx) => {
      const current = await getTaskRow(id, tx);
      if (!current) return null;
      const { dueAt, ...fields } = input;
      await tx.update(tasks).set({
        ...fields,
        dueAt: dueAt === undefined ? undefined : normalizeDueAt(dueAt),
        updatedAt: touch ? now.toISOString() : undefined,
        searchText: toSearchText(fields.title ?? current.title, fields.description ?? current.description),
      }).where(eq(tasks.id, id)).run();
      return getTaskWith(tx, id);
    });

  /** Підзадачі й нотатки видаляє каскад FK, `agent_runs.task_id` стає `null`. */
  const deleteTask = async (id: string) => (await db.delete(tasks).where(eq(tasks.id, id)).run()).rowsAffected > 0;

  const touchTask = (connection: DbExecutor, id: string, now: string) =>
    connection.update(tasks).set({ updatedAt: now }).where(eq(tasks.id, id)).run();

  const addSubtasks = (taskId: string, items: SubtaskCreateInput[], now: Date): Promise<Subtask[] | null> =>
    db.transaction(async (tx) => {
      if (!await getTaskRow(taskId, tx)) return null;
      if (!items.length) return [];
      const { last } = await tx.select({ last: max(subtasks.position) }).from(subtasks)
        .where(eq(subtasks.taskId, taskId)).get() ?? { last: null };
      const nowIso = now.toISOString();
      const inserted = await tx.insert(subtasks).values(items.map((item, index): typeof subtasks.$inferInsert => ({
        ...item, id: createId(), taskId, status: "todo",
        position: (last ?? -1) + index + 1, createdAt: nowIso,
      }))).returning().all();
      await touchTask(tx, taskId, nowIso);
      return inserted;
    });

  const updateSubtask = (taskId: string, id: string, input: SubtaskUpdateInput, now: Date): Promise<Subtask | null> =>
    db.transaction(async (tx) => {
      const row = await tx.update(subtasks).set(input)
        .where(and(eq(subtasks.id, id), eq(subtasks.taskId, taskId))).returning().get();
      if (row) await touchTask(tx, taskId, now.toISOString());
      return row ?? null;
    });

  const deleteSubtask = (taskId: string, id: string, now: Date): Promise<boolean> =>
    db.transaction(async (tx) => {
      const result = await tx.delete(subtasks).where(and(eq(subtasks.id, id), eq(subtasks.taskId, taskId))).run();
      if (result.rowsAffected) await touchTask(tx, taskId, now.toISOString());
      return result.rowsAffected > 0;
    });

  const addNote = (taskId: string, input: NoteCreateInput, now: Date): Promise<Note | null> =>
    db.transaction(async (tx) => {
      if (!await getTaskRow(taskId, tx)) return null;
      const timestamp = now.toISOString();
      const note = await tx.insert(notes).values({ ...input, taskId, id: createId(), createdAt: timestamp })
        .returning().get();
      await touchTask(tx, taskId, timestamp);
      return note;
    });

  const setFocus = (taskIds: string[]) => db.transaction(async (tx) => {
    if (new Set(taskIds).size !== taskIds.length) throw new Error("Focus task IDs must be unique");
    if (taskIds.length && (await tx.select({ id: tasks.id }).from(tasks).where(inArray(tasks.id, taskIds)).all()).length !== taskIds.length) {
      throw new NotFoundError("Focus includes an unknown task");
    }
    await tx.update(tasks).set({ focusRank: null }).where(isNotNull(tasks.focusRank)).run();
    const ranks: { taskId: string; focusRank: number }[] = [];
    for (const [index, taskId] of taskIds.entries()) {
      const focusRank = index + 1;
      await tx.update(tasks).set({ focusRank }).where(eq(tasks.id, taskId)).run();
      ranks.push({ taskId, focusRank });
    }
    return ranks;
  });

  const findStale = ({ minDays, now }: { minDays: number; now: Date }): Promise<TaskRow[]> =>
    db.select(TASK_COLUMNS).from(tasks).where(and(
      eq(tasks.status, "in-progress"),
      lte(tasks.updatedAt, new Date(now.getTime() - minDays * MS_PER_DAY).toISOString()),
    )).orderBy(asc(tasks.updatedAt), asc(tasks.id)).all();

  return {
    listTasks, listTaskPage, readSnapshot, getTask, getTaskRow: (id: string) => getTaskRow(id), createTask, updateTask,
    deleteTask, addSubtasks, updateSubtask, deleteSubtask, addNote, setFocus, findStale,
  };
};
