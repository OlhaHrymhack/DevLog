import type { TaskSummary } from "@/entities/task";
import { plural } from "@/shared/lib/plural";

export const formatTaskSummary = ({ all, "in-progress": inProgress, hot }: TaskSummary, serious: boolean) => {
  const total = `${all} ${plural(all, "задача", "задачі", "задач")}`;
  if (all === 0) return total;
  const heat = hot ? ` · ${hot} ${plural(hot, "гаряча", "гарячі", "гарячих")}${serious ? "" : " 🌶️"}` : "";
  return `${total} · ${inProgress} в роботі${heat}`;
};
