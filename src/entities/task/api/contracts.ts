import { z } from "zod";
import { SubtaskCreateInputSchema, SubtaskStatusSchema } from "../model/schemas";

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
