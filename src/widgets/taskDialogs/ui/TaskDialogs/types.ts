import type { TaskRowData } from "@/entities/task";

export type TaskDialog = { kind: "create" } | { kind: "edit" | "delete"; task: TaskRowData };

export type TaskDialogsProps = {
  dialog: TaskDialog;
  serious: boolean;
  voiceMode?: "demo" | "live";
  onClose: () => void;
  onCreated?: () => void;
  onDeleted?: () => void;
};
