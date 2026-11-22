import { DayPlanSchema } from "@/entities/agentRun";
import type { PlanEntry } from "../ui/PlanList/types";

type TaskTitle = { id: string; title: string };

export type ResolvedPlan = {
  items: PlanEntry[];
  deferred: { id: string; title: string; reason: string }[];
};

/**
 * Результат агента → записи для UI з назвами задач. Невалідні дані дають `null`; задачі, яких уже немає
 * в списку (видалені після запуску), пропускаються. У fallback і в серйозному режимі пояснення й жарти не показуємо.
 */
export const resolvePlan = (
  data: unknown,
  tasks: readonly TaskTitle[],
  { fromRule, serious }: { fromRule: boolean; serious: boolean },
): ResolvedPlan | null => {
  const parsed = DayPlanSchema.safeParse(data);
  if (!parsed.success) return null;
  const titles = new Map(tasks.map((task) => [task.id, task.title]));
  const items = parsed.data.items.flatMap((item) => {
    const title = titles.get(item.taskId);
    if (title === undefined) return [];
    return [{ id: item.taskId, title, ...(fromRule ? {} : { why: item.why, joke: serious ? null : item.joke }) }];
  });
  const deferred = parsed.data.deferred.flatMap((entry) => {
    const title = titles.get(entry.taskId);
    return title === undefined ? [] : [{ id: entry.taskId, title, reason: entry.reason }];
  });
  return { items, deferred };
};
