import { getHeat, STATUS_LABELS, PRIORITY_LABELS, type Task, type TaskRowData } from "@/entities/task";
import { taskUpdatedMessage } from "@/features/taskEdit";

export const statusChangedMessage = (before: TaskRowData, after: Task, serious: boolean, now: number) =>
  after.status === "done" && getHeat(before, now).rank >= 2
    ? taskUpdatedMessage(before, after, serious, now)
    : `Статус: ${STATUS_LABELS[after.status]}`;

export const priorityChangedMessage = (after: Pick<Task, "priority">) =>
  `Пріоритет: ${PRIORITY_LABELS[after.priority]}`;

export const allSubtasksDoneMessage = (serious: boolean) =>
  serious
    ? "Усі підзадачі готові. Можна закривати задачу"
    : "🏁 Усі підзадачі готові. Закрий задачу, поки вона не передумала";
