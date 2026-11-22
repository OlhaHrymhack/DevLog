import type { TaskRowData } from "@/entities/task";

export type TasksListViewProps = {
  onNewTask?: () => void;
  onEdit?: (task: TaskRowData) => void;
  onDelete?: (task: TaskRowData) => void;
};
