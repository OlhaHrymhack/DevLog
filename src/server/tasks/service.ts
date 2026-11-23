import "server-only";
import {
  NoteCreateInputSchema, SubtaskCreateInputSchema, SubtaskUpdateInputSchema,
  TaskCreateInputSchema, TaskUpdateInputSchema, type TaskPageQuery,
} from "@/entities/task";
import { getDb, type DbExecutor } from "../db/client";
import { createTaskRepository } from "./repository";

export const createTaskService = ({ db, clock = () => new Date() }: { db: DbExecutor; clock?: () => Date }) => {
  const repository = createTaskRepository(db);

  /** Читання поточного стану й запис — одна транзакція; репозиторій працює через `tx` (вкладене — savepoint). */
  const updateTask = (id: string, input: unknown) => {
    const patch = TaskUpdateInputSchema.parse(input);
    return db.transaction(async (tx) => {
      const scoped = createTaskRepository(tx);
      const current = await scoped.getTaskRow(id);
      if (!current) return null;
      const touch = (patch.title !== undefined && patch.title !== current.title)
        || (patch.description !== undefined && patch.description !== current.description)
        || (patch.status !== undefined && patch.status !== current.status)
        || (patch.priority !== undefined && patch.priority !== current.priority);
      return scoped.updateTask(id, patch, { now: clock(), touch });
    });
  };

  return {
    ...repository,
    listTaskPage: (query: TaskPageQuery) => repository.listTaskPage(query, clock()),
    createTask: (input: unknown) => repository.createTask(TaskCreateInputSchema.parse(input), clock()),
    updateTask,
    addSubtasks: (taskId: string, items: unknown) =>
      repository.addSubtasks(taskId, SubtaskCreateInputSchema.array().parse(items), clock()),
    updateSubtask: (taskId: string, id: string, input: unknown) =>
      repository.updateSubtask(taskId, id, SubtaskUpdateInputSchema.parse(input), clock()),
    deleteSubtask: (taskId: string, id: string) => repository.deleteSubtask(taskId, id, clock()),
    addNote: (taskId: string, input: unknown) => repository.addNote(taskId, NoteCreateInputSchema.parse(input), clock()),
  };
};

export const getTaskService = async () => createTaskService({ db: (await getDb()).db });
