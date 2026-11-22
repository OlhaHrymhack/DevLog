import type { TaskPriority, TaskStatus } from "@/entities/task";

export const pillStyles = "relative inline-flex items-center";
export const selectStyles = "min-h-11 appearance-none rounded-full py-1.5 pl-3 pr-8 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-wait md:min-h-9 [&>option]:bg-surface [&>option]:text-fg";
export const arrowStyles = "pointer-events-none absolute right-2.5 size-3.5";
export const statusStyles: Record<TaskStatus, string> = {
  "todo": "bg-status-todo-bg text-status-todo-fg",
  "in-progress": "bg-status-progress-bg text-status-progress-fg",
  "done": "bg-status-done-bg text-status-done-fg",
};
export const priorityStyles: Record<TaskPriority, string> = {
  high: "text-priority-high",
  medium: "text-priority-medium",
  low: "text-priority-low",
};
