import type { Subtask } from "@/entities/task";

type SubtaskState = Pick<Subtask, "status">;

export const getSubtaskProgress = (subtasks: readonly SubtaskState[]) => {
  const total = subtasks.length;
  const done = subtasks.filter(({ status }) => status === "done").length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
};

export const areAllSubtasksDone = (subtasks: readonly SubtaskState[]) =>
  subtasks.length > 0 && subtasks.every(({ status }) => status === "done");
