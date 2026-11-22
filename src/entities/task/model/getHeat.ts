import { daysBetween } from "@/shared/lib/daysBetween";
import { MS_PER_HOUR, toMillis, type Timestamp } from "@/shared/lib/timestamp";
import { HEAT_LEVELS, type HeatLevel } from "./heatLevels";
import type { HeatInput } from "./types";

const ALARM_WINDOW_MS = 24 * MS_PER_HOUR;

/**
 * Температура задачі — чиста функція (DESIGN §4). Порядок перевірок:
 * done → alarm (дедлайн менше ніж за 24 год) → low → calm → high 7+/5+/3+ → medium 3+ → fresh.
 */
export const getHeat = (task: HeatInput, now: Timestamp): HeatLevel => {
  if (task.status === "done") return HEAT_LEVELS.done;
  if (task.dueAt !== undefined && toMillis(task.dueAt) - toMillis(now) < ALARM_WINDOW_MS) {
    return HEAT_LEVELS.alarm;
  }
  if (task.priority === "low") return HEAT_LEVELS.calm;

  const staleDays = daysBetween(task.updatedAt, now);
  if (task.priority === "high") {
    if (staleDays >= 7) return HEAT_LEVELS.fire;
    if (staleDays >= 5) return HEAT_LEVELS.hot;
    if (staleDays >= 3) return HEAT_LEVELS.warm;
  }
  if (task.priority === "medium" && staleDays >= 3) return HEAT_LEVELS.warm;
  return HEAT_LEVELS.fresh;
};
