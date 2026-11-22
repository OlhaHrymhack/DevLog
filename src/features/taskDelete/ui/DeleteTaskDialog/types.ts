import type { TaskRowData } from "@/entities/task";

export type DeleteTaskDialogProps = {
  task: TaskRowData;
  serious: boolean;
  onClose: () => void;
  onDeleted?: () => void;
  fallbackFocus?: () => HTMLElement | null;
};
