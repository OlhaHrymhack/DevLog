import { DAY_PLAN_MAX_ITEMS, type DayPlan } from "@/entities/agentRun";
import type { TaskListItem } from "@/entities/task";
import { toMillis } from "@/shared/lib/timestamp";
import { isActive } from "./activeTasks";
import { isUrgent, PRIORITY_WEIGHT } from "./scoreTask";

/** Фіксований текст замість пояснення: fallback без AI, UI його не показує, але схема й перевірка фактів його вимагають. */
export const RULE_PLAN_WHY = "Порядок за простим правилом: пріоритет, вік, статус.";

const inProgress = (task: Pick<TaskListItem, "status">): number => (task.status === "in-progress" ? 1 : 0);

const urgentFirst = (task: TaskListItem, now: Date): number => (isUrgent(task, now) ? 1 : 0);

/**
 * Прототип `rulePlan`: термінові (дедлайн < 48 год) першими, далі пріоритет ↓ → старіші першими → «в роботі» першими.
 * Термінові йдуть першими, бо перевірка фактів ядра вимагає їх у плані й для fallback.
 */
export const rulePlanOrder = (tasks: readonly TaskListItem[], now: Date): TaskListItem[] =>
  tasks.filter(isActive).sort((a, b) =>
    urgentFirst(b, now) - urgentFirst(a, now)
    || PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
    || toMillis(a.createdAt) - toMillis(b.createdAt)
    || inProgress(b) - inProgress(a));

/** Детермінований fallback: top-3 за правилом, без пояснень від AI і без «Відкладено». Без активних задач план порожній (UI не запускає агента). */
export const rulePlan = (tasks: readonly TaskListItem[], now: Date): DayPlan => ({
  items: rulePlanOrder(tasks, now).slice(0, DAY_PLAN_MAX_ITEMS).map((task) => ({ taskId: task.id, why: RULE_PLAN_WHY, joke: null })),
  deferred: [],
});
