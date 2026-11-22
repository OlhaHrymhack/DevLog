import { STUCK_MIN_DAYS } from "@/entities/agentRun";
import type { Task } from "@/entities/task";
import { daysBetween } from "@/shared/lib/daysBetween";
import type { AgentContext } from "../core/types";
import { openSubtaskCount } from "./diagnose";

export const MAX_STALE_TASKS = 20;

export type StaleTask = { task: Task; staleDays: number };

/** «В роботі» без змін ≥ `minDays` діб, крім відкладених; найдавніші першими. Чиста функція від `ctx.now`. */
export const findStaleTasks = (ctx: AgentContext, snoozedIds: readonly string[], minDays: number = STUCK_MIN_DAYS): StaleTask[] => {
  const snoozed = new Set(snoozedIds);
  return ctx.tasks.listTasks({ status: "in-progress" })
    .filter((item) => !snoozed.has(item.id))
    .map((item) => ({ id: item.id, staleDays: daysBetween(item.updatedAt, ctx.now) }))
    .filter(({ staleDays }) => staleDays >= minDays)
    .sort((a, b) => b.staleDays - a.staleDays || a.id.localeCompare(b.id))
    .slice(0, MAX_STALE_TASKS)
    .flatMap(({ id, staleDays }) => {
      const task = ctx.tasks.getTask(id);
      return task ? [{ task, staleDays }] : [];
    });
};

export const toStaleView = ({ task, staleDays }: StaleTask) => ({
  id: task.id,
  title: task.title,
  staleDays,
  openSubtasks: openSubtaskCount(task),
  subtaskCount: task.subtasks.length,
  noteCount: task.notes.length,
});
