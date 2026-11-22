import type { z } from "zod";
import type { Timestamp } from "@/shared/lib/timestamp";
import type {
  NoteCreateInputSchema,
  NoteSchema,
  SortOrderSchema,
  SubtaskCreateInputSchema,
  SubtaskSchema,
  SubtaskSourceSchema,
  SubtaskStatusSchema,
  SubtaskUpdateInputSchema,
  TaskCreateInputSchema,
  TaskListItemSchema,
  TaskListQuerySchema,
  TaskPrioritySchema,
  TaskSchema,
  TaskSortSchema,
  TaskStatusSchema,
  TaskUpdateInputSchema,
} from "./schemas";

export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;
export type SubtaskStatus = z.infer<typeof SubtaskStatusSchema>;
export type SubtaskSource = z.infer<typeof SubtaskSourceSchema>;

export type Task = z.infer<typeof TaskSchema>;
export type TaskListItem = z.infer<typeof TaskListItemSchema>;
export type Subtask = z.infer<typeof SubtaskSchema>;
export type Note = z.infer<typeof NoteSchema>;

export type TaskCreateInput = z.infer<typeof TaskCreateInputSchema>;
export type TaskUpdateInput = z.infer<typeof TaskUpdateInputSchema>;
export type SubtaskCreateInput = z.infer<typeof SubtaskCreateInputSchema>;
export type SubtaskUpdateInput = z.infer<typeof SubtaskUpdateInputSchema>;
export type NoteCreateInput = z.infer<typeof NoteCreateInputSchema>;

export type TaskSort = z.infer<typeof TaskSortSchema>;
export type SortOrder = z.infer<typeof SortOrderSchema>;
export type TaskListQuery = z.infer<typeof TaskListQuerySchema>;

/**
 * Поля задачі, потрібні для температури. `status`/`priority` — з `Task`; дати лишаються `Timestamp`,
 * бо `getHeat` — чиста функція і приймає ISO-рядок, мілісекунди або `Date`. `Task` сумісна з цим типом.
 */
export type HeatInput = Pick<Task, "status" | "priority"> & {
  updatedAt: Timestamp;
  dueAt?: Timestamp | null;
};
