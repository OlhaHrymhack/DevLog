import type { TaskCreateInput } from "@/entities/task";

export type TaskFormValues = Pick<TaskCreateInput, "title" | "description" | "status" | "priority">;
export type TaskFormField = keyof TaskFormValues;
export type TaskFieldErrors = Partial<Record<TaskFormField, string>>;
