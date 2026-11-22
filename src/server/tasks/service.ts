import "server-only";
import {
  NoteCreateInputSchema, SubtaskCreateInputSchema, SubtaskUpdateInputSchema,
  TaskCreateInputSchema, TaskUpdateInputSchema,
} from "@/entities/task";
import { getDb, type DevLogDb } from "../db/client";
import { createTaskRepository } from "./repository";

export const createTaskService = ({ db, clock = () => new Date() }: { db: DevLogDb; clock?: () => Date }) => {
  const repository = createTaskRepository(db);

  const updateTask = (id: string, input: unknown) => {
    const patch = TaskUpdateInputSchema.parse(input);
    return db.transaction(() => {
      const current = repository.getTaskRow(id);
      if (!current) return null;
      const touch = (patch.title !== undefined && patch.title !== current.title)
        || (patch.description !== undefined && patch.description !== current.description)
        || (patch.status !== undefined && patch.status !== current.status)
        || (patch.priority !== undefined && patch.priority !== current.priority);
      return repository.updateTask(id, patch, { now: clock(), touch });
    }, { behavior: "immediate" });
  };

  return {
    ...repository,
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

export const getTaskService = () => createTaskService({ db: getDb().db });
