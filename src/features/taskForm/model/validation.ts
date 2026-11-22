import { TaskCreateInputSchema } from "@/entities/task";
import { ApiError } from "@/shared/api/http";
import type { TaskFieldErrors, TaskFormValues } from "./types";

export const TASK_FIELDS = ["title", "description", "status", "priority"] as const;

export const EMPTY_TASK_FORM: TaskFormValues = {
  title: "", description: "", status: "todo", priority: "medium",
};

export const validateTaskForm = (values: TaskFormValues) => {
  const result = TaskCreateInputSchema.safeParse(values);
  if (result.success) return { values: result.data, errors: undefined };

  const errors: TaskFieldErrors = {};
  for (const issue of result.error.issues) {
    const field = TASK_FIELDS.find((name) => name === issue.path[0]);
    if (!field || errors[field]) continue;
    if (field === "title") {
      errors[field] = issue.code === "too_big" ? "Назва має містити не більше 120 символів." : "Назва обовʼязкова, щонайменше 3 символи.";
    } else if (field === "description") {
      errors[field] = issue.code === "too_big" ? "Опис має містити не більше 2000 символів." : "Опишіть задачу хоча б одним реченням.";
    } else {
      errors[field] = "Виберіть одне зі значень.";
    }
  }
  return { values: undefined, errors };
};

export const getTaskFieldErrors = (error: unknown): TaskFieldErrors | undefined => {
  if (!(error instanceof ApiError) || error.status !== 400) return;
  const errors: TaskFieldErrors = {};
  for (const field of TASK_FIELDS) {
    const message = error.fieldErrors?.[field]?.[0];
    if (message) errors[field] = message;
  }
  if (Object.keys(errors).length > 0) return errors;
};
