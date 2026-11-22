import type { Task, TaskPriority, TaskStatus } from "@/entities/task";

export type TaskOverviewProps = {
  task: Task;
  serious: boolean;
  now: number;
  pending: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onPriorityChange: (priority: TaskPriority) => void;
};
