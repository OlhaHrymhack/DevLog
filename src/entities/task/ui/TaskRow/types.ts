import type { Timestamp } from "@/shared/lib/timestamp";
import type { Task } from "../../model/types";

/** Поля задачі, потрібні рядку. `Task` і `TaskListItem` підходять без перетворень. */
export type TaskRowData = Pick<Task, "id" | "title" | "description" | "status" | "priority" | "createdAt" | "updatedAt" | "dueAt">;

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
