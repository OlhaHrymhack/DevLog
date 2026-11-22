import type { TaskPriority, TaskStatus } from "@/entities/task";

export type TaskMetadataSelectsProps = {
  status: TaskStatus;
  priority: TaskPriority;
  pending: boolean;
  onStatusChange: (status: TaskStatus) => void;
  onPriorityChange: (priority: TaskPriority) => void;
};
