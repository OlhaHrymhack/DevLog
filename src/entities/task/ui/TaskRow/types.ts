import type { Timestamp } from "@/shared/lib/timestamp";
import type { HeatInput } from "../../model/types";

/** Поля задачі, потрібні рядку. Повна `Task` зі схеми з'явиться в DEV-003. */
export type TaskRowData = HeatInput & {
  id: string;
  title: string;
  description: string;
  createdAt: Timestamp;
};

export type TaskRowProps = {
  task: TaskRowData;
  /** Поточний час — параметр, щоб рендер був детермінованим (SSR і тести). */
  now: Timestamp;
  /** Позначка «Фокус #N» від агента A. */
  focusRank?: number;
  /** Серйозний режим: tooltip температури без жарту. */
  serious?: boolean;
  onEdit: (task: TaskRowData) => void;
  onDelete: (task: TaskRowData) => void;
};
