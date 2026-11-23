import "server-only";
import { z } from "zod";
import { getHeat } from "@/entities/task";
import { NotFoundError } from "@/shared/api/errors";
import { daysBetween } from "@/shared/lib/daysBetween";
import { defineTool } from "../core/tools";

export const TASK_CONTEXT_TOOL = "get_task_context";
export const MAX_CONTEXT_ITEMS = 20;
export const MAX_CONTEXT_TEXT_CHARS = 500;

/** Лише читання: задача, підзадачі (з id і статусом), нотатки, температура й дні без змін — для чернетки апдейту. */
export const taskContextTool = defineTool({
  name: TASK_CONTEXT_TOOL,
  label: "Зібрати задачу, підзадачі й нотатки",
  description: `Повертає задачу за id: статус, пріоритет, дедлайн, heat, staleDays, підзадачі (id, title, done) і нотатки (id, text, createdAt), до ${MAX_CONTEXT_ITEMS} кожного. Лише читання.`,
  inputSchema: z.object({ id: z.string().min(1) }),
  run: ({ id }, ctx) => {
    const task = ctx.tasks.getTask(id);
    if (!task) throw new NotFoundError(`Задачу ${id} не знайдено`);
    return {
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueAt: task.dueAt,
      heat: getHeat(task, ctx.now).key,
      staleDays: Math.floor(daysBetween(task.updatedAt, ctx.now)),
      thin: task.subtasks.length === 0 && task.notes.length === 0,
      subtasks: task.subtasks.slice(0, MAX_CONTEXT_ITEMS).map((subtask) => ({
        id: subtask.id, title: subtask.title, done: subtask.status === "done",
      })),
      notes: task.notes.slice(-MAX_CONTEXT_ITEMS).map((note) => ({
        id: note.id, text: note.text.slice(0, MAX_CONTEXT_TEXT_CHARS), createdAt: note.createdAt,
      })),
    };
  },
});
