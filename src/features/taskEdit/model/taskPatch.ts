import { getHeat, TaskUpdateInputSchema, type Task, type TaskRowData, type TaskUpdateInput } from "@/entities/task";

type EditableTask = Pick<Task, "title" | "description" | "status" | "priority">;

export const getTaskPatch = (before: EditableTask, after: EditableTask) => {
  const patch: TaskUpdateInput = {};
  if (after.title !== before.title) patch.title = after.title;
  if (after.description !== before.description) patch.description = after.description;
  if (after.status !== before.status) patch.status = after.status;
  if (after.priority !== before.priority) patch.priority = after.priority;
  return Object.keys(patch).length > 0 ? TaskUpdateInputSchema.parse(patch) : undefined;
};

export const taskUpdatedMessage = (before: TaskRowData, after: Task, serious: boolean, now: number) => {
  if (after.status === "done" && getHeat(before, now).rank >= 2) {
    return serious ? "Задачу закрито" : "🧯 Пожежу загашено. Звіт для страхової не потрібен";
  }
  return "Зміни збережено";
};
