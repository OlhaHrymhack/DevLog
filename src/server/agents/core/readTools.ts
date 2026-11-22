import "server-only";
import { z } from "zod";
import { TaskStatusSchema } from "@/entities/task";
import { NotFoundError } from "@/shared/api/errors";
import type { DevLogDb } from "../../db/client";
import { createTaskRepository } from "../../tasks/repository";
import { defineTool } from "./tools";
import type { AgentContext } from "./types";

/** Контекст агента: лише методи читання репозиторію задач. */
export const createAgentContext = (db: DevLogDb, now = new Date()): AgentContext => {
  const repository = createTaskRepository(db);
  return { tasks: { listTasks: repository.listTasks, getTask: repository.getTask }, now };
};

/** Ліміти результату `list_tasks` проти роздування контексту моделі недовіреними даними. */
export const MAX_LISTED_TASKS = 50;
export const MAX_LISTED_DESCRIPTION_CHARS = 500;

export const listTasksTool = defineTool({
  name: "list_tasks",
  label: "Прочитати список задач",
  description: `Повертає до ${MAX_LISTED_TASKS} задач з лічильниками підзадач і скороченим описом; status = null — усі статуси. Лише читання.`,
  inputSchema: z.object({ status: TaskStatusSchema.nullable() }),
  run: ({ status }, ctx) => {
    const tasks = ctx.tasks.listTasks(status ? { status } : {});
    return {
      total: tasks.length,
      truncated: tasks.length > MAX_LISTED_TASKS,
      tasks: tasks.slice(0, MAX_LISTED_TASKS).map((task) => ({
        ...task, description: task.description.slice(0, MAX_LISTED_DESCRIPTION_CHARS),
      })),
    };
  },
});

export const getTaskTool = defineTool({
  name: "get_task",
  label: "Прочитати задачу",
  description: "Повертає одну задачу з описом, підзадачами й нотатками за id. Лише читання.",
  inputSchema: z.object({ id: z.string().min(1) }),
  run: ({ id }, ctx) => {
    const task = ctx.tasks.getTask(id);
    if (!task) throw new NotFoundError(`Задачу ${id} не знайдено`);
    return task;
  },
});

export const READ_TOOLS = [listTasksTool, getTaskTool] as const;
