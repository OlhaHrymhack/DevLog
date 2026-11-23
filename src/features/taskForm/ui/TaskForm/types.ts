import type { TaskRowData } from "@/entities/task";
import type { TaskFormValues } from "../../model/types";

export type TaskFormProps = {
  task?: TaskRowData;
  voiceMode?: "demo" | "live";
  onSave: (values: TaskFormValues) => Promise<void>;
  onClose: () => void;
  fallbackFocus?: () => HTMLElement | null;
};
