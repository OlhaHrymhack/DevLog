import "server-only";
import { z } from "zod";
import { STUCK_MIN_DAYS } from "@/entities/agentRun";
import { defineTool } from "../core/tools";
import { findStaleTasks, MAX_STALE_TASKS, toStaleView } from "./staleTasks";

export const FIND_STALE_TASKS_TOOL = "find_stale_tasks";

/** Лише читання: «в роботі» без змін ≥ minDays, крім відкладених користувачем (їх передає запуск, не модель). */
export const createFindStaleTasksTool = (snoozedIds: readonly string[]) => defineTool({
  name: FIND_STALE_TASKS_TOOL,
  label: "Знайти задачі «в роботі» без змін",
  description: `Повертає до ${MAX_STALE_TASKS} задач «в роботі» без змін понад minDays діб (за замовчуванням ${STUCK_MIN_DAYS}): id, title, staleDays, openSubtasks, subtaskCount, noteCount. Відкладені користувачем уже виключено. Лише читання.`,
  inputSchema: z.object({ minDays: z.number().int().min(1).max(365) }),
  run: ({ minDays }, ctx) => {
    const found = findStaleTasks(ctx, snoozedIds, minDays);
    return { total: found.length, tasks: found.map(toStaleView) };
  },
});
