import type { TaskListItem, TaskRowData } from "@/entities/task";

export type TaskListProps = {
  tasks: TaskListItem[];
  now: number;
  serious: boolean;
  onEdit?: (task: TaskRowData) => void;
  onDelete?: (task: TaskRowData) => void;
};
