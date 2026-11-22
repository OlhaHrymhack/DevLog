import "server-only";
import { z } from "zod";
import { defineTool } from "../core/tools";
import { MAX_LISTED_TASKS } from "../core/readTools";
import { isActive, toActiveTaskView } from "./activeTasks";

export const LIST_ACTIVE_TASKS_TOOL = "list_active_tasks";

/** Лише читання: активні задачі (статус ≠ done) з обчисленими віком, днями без змін, дедлайном, температурою і вагою. */
export const listActiveTasksTool = defineTool({
  name: LIST_ACTIVE_TASKS_TOOL,
  label: "Прочитати активні задачі",
  description: `Повертає до ${MAX_LISTED_TASKS} активних задач (статус не «done»): id, назва, статус, пріоритет, ageDays, staleDays, dueInHours, urgent, heat, openSubtasks і score — підказка за вагою. limit = null — усі. Лише читання.`,
  inputSchema: z.object({ limit: z.number().int().min(1).max(MAX_LISTED_TASKS).nullable() }),
  run: ({ limit }, ctx) => {
    const active = ctx.tasks.listTasks().filter(isActive);
    const views = active.map((task) => toActiveTaskView(task, ctx.now));
    return { total: views.length, tasks: views.slice(0, limit ?? MAX_LISTED_TASKS) };
  },
});
