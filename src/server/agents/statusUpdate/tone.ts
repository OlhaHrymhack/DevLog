import type { StatusUpdateTone } from "@/entities/agentRun";
import { getHeat, type Task } from "@/entities/task";

const MANAGER_HEAT_RANK = 2;

export type ToneSuggestion = { tone: StatusUpdateTone; reason: string };

/** Авто-тон (прототип `autoTone`): done → команда; гаряча (rank ≥ 2) або є дедлайн → менеджер; інакше команда. */
export const autoTone = (task: Pick<Task, "status" | "priority" | "updatedAt" | "dueAt">, now: Date): ToneSuggestion => {
  if (task.status === "done") return { tone: "team", reason: "задачу закрито, пишу для команди" };
  const risky = getHeat(task, now).rank >= MANAGER_HEAT_RANK || task.dueAt !== null;
  return risky
    ? { tone: "manager", reason: "є ризик або дедлайн, тож пишу для менеджера" }
    : { tone: "team", reason: "звичайний прогрес, пишу для команди" };
};
