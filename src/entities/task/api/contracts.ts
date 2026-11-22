import { z } from "zod";
import { SubtaskCreateInputSchema, SubtaskStatusSchema, TaskListItemSchema, TaskListQuerySchema } from "../model/schemas";

export const AddSubtasksInputSchema = z.strictObject({
  items: z.array(SubtaskCreateInputSchema.strict()).min(1).max(6),
});

export const SetSubtaskStatusInputSchema = z.strictObject({
  status: SubtaskStatusSchema,
});

export const SetFocusInputSchema = z.strictObject({
  taskIds: z.array(z.string().min(1)).max(3).refine(
    (ids) => new Set(ids).size === ids.length,
    "Ідентифікатори задач мають бути унікальними",
  ),
});

export const FocusAssignmentSchema = z.object({
  taskId: z.string().min(1),
  focusRank: z.number().int().positive(),
});

export type AddSubtasksInput = z.infer<typeof AddSubtasksInputSchema>;
export type SetFocusInput = z.infer<typeof SetFocusInputSchema>;
export type SetSubtaskStatusInput = z.infer<typeof SetSubtaskStatusInputSchema>;

const positiveInteger = z.union([z.number(), z.string().regex(/^[1-9]\d*$/).transform(Number)])
  .pipe(z.int().positive());

export const TaskPageQuerySchema = TaskListQuerySchema.extend({
  page: positiveInteger.default(1),
  pageSize: positiveInteger.pipe(z.int().max(100)).default(10),
});

const TaskSummarySchema = z.object({
  all: z.int().nonnegative(),
  todo: z.int().nonnegative(),
  "in-progress": z.int().nonnegative(),
  done: z.int().nonnegative(),
  hot: z.int().nonnegative(),
});

export const TaskPageSchema = z.object({
  data: z.array(TaskListItemSchema),
  pagination: z.object({
    page: z.int().positive(),
    pageSize: z.int().positive(),
    total: z.int().nonnegative(),
    totalPages: z.int().nonnegative(),
  }),
  summary: TaskSummarySchema,
});

export type TaskPageQuery = z.infer<typeof TaskPageQuerySchema>;
export type TaskPage = z.infer<typeof TaskPageSchema>;
export type TaskSummary = z.infer<typeof TaskSummarySchema>;
