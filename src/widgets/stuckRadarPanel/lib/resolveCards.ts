import { TriageSchema, type TriageItem } from "@/entities/agentRun";
import { getHeat, type HeatKey, type TaskListItem } from "@/entities/task";
import { daysBetween } from "@/shared/lib/daysBetween";

export type StuckCardModel = { item: TriageItem; title: string; staleDays: number; heat: HeatKey };

/** Картки з результату агента: лише задачі, що досі «в роботі» й не відкладені (змінені статуси ховаємо без повторного сканування). */
export const resolveCards = (data: unknown, tasks: readonly TaskListItem[], snoozedIds: readonly string[], now: Date): StuckCardModel[] => {
  const parsed = TriageSchema.safeParse(data);
  if (!parsed.success) return [];
  const byId = new Map(tasks.map((task) => [task.id, task]));
  return parsed.data.items.flatMap((item) => {
    const task = byId.get(item.taskId);
    if (!task || task.status !== "in-progress" || snoozedIds.includes(item.taskId)) return [];
    return [{ item, title: task.title, staleDays: daysBetween(task.updatedAt, now), heat: getHeat(task, now).key }];
  });
};
