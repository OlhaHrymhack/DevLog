import type { Subtask } from "@/entities/task";

export type SubtaskListProps = {
  taskId: string;
  subtasks: Subtask[];
  pending: boolean;
  onToggle: (subtask: Subtask) => void;
  onDelete: (subtask: Subtask) => void;
  onDecompose?: () => void;
};
