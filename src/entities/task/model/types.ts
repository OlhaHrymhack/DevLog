import type { z } from "zod";
import type { Timestamp } from "@/shared/lib/timestamp";
import type { TaskPrioritySchema, TaskStatusSchema } from "./schemas";

export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

/** Поля задачі, потрібні для температури. Повна `Task` зі схеми з'явиться в DEV-003. */
export type HeatInput = {
  status: TaskStatus;
  priority: TaskPriority;
  updatedAt: Timestamp;
  dueAt?: Timestamp;
};
