import type { TaskListItem } from "@/entities/task";
import { daysBetween } from "@/shared/lib/daysBetween";
import { MS_PER_HOUR, toMillis } from "@/shared/lib/timestamp";

export const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 } as const;

const URGENT_WINDOW_HOURS = 48;
const URGENT_BONUS = 30;
const IN_PROGRESS_BONUS = 6;
const MAX_FACTOR_DAYS = 14;
const AGE_FACTOR = 1.2;
const STALE_FACTOR = 0.8;
const PRIORITY_FACTOR = 10;

export type ScorableTask = Pick<TaskListItem, "priority" | "status" | "createdAt" | "updatedAt" | "dueAt">;

/** Дедлайн менш ніж за 48 годин (прострочений теж). */
export const isUrgent = (task: Pick<ScorableTask, "dueAt">, now: Date): boolean =>
  task.dueAt != null && toMillis(task.dueAt) - now.getTime() < URGENT_WINDOW_HOURS * MS_PER_HOUR;

/** Вага задачі: пріоритет, вік, дні без змін, «в роботі» і дедлайн < 48 год. Прототип `scoreTask`. */
export const scoreTask = (task: ScorableTask, now: Date): number => {
  const age = Math.min(daysBetween(task.createdAt, now), MAX_FACTOR_DAYS);
  const stale = Math.min(daysBetween(task.updatedAt, now), MAX_FACTOR_DAYS);
  const base = PRIORITY_WEIGHT[task.priority] * PRIORITY_FACTOR + age * AGE_FACTOR + stale * STALE_FACTOR;
  return base + (task.status === "in-progress" ? IN_PROGRESS_BONUS : 0) + (isUrgent(task, now) ? URGENT_BONUS : 0);
};
