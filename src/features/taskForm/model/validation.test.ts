import { describe, expect, it } from "vitest";
import { ApiError } from "@/shared/api/http";
import { EMPTY_TASK_FORM, getTaskFieldErrors, validateTaskForm } from "./validation";

describe("task form validation", () => {
  it("DEV-006 AC-2: validates both required fields and trims valid submissions", () => {
    const invalid = validateTaskForm({ ...EMPTY_TASK_FORM, title: " ab ", description: "   " });
    expect(invalid.values).toBeUndefined();
    expect(invalid.errors).toEqual({
      title: "Назва обовʼязкова, щонайменше 3 символи.",
      description: "Опишіть задачу хоча б одним реченням.",
    });
    const valid = validateTaskForm({ ...EMPTY_TASK_FORM, title: " Назва ", description: " Короткий опис. " });
    expect(valid.values).toEqual({ title: "Назва", description: "Короткий опис.", status: "todo", priority: "medium" });
  });

  it("DEV-006 AC-3: maps errors from 400 to known fields and ignores unrelated responses", () => {
    expect(getTaskFieldErrors(new ApiError("VALIDATION_ERROR", "Помилка", 400, {
      title: ["Така назва вже є", "Інша помилка"], dueAt: ["Невідома помилка форми"],
    }))).toEqual({ title: "Така назва вже є" });
    expect(getTaskFieldErrors(new ApiError("INTERNAL_ERROR", "Помилка", 500))).toBeUndefined();
    expect(getTaskFieldErrors(new ApiError("VALIDATION_ERROR", "Помилка", 400, { dueAt: ["Помилка"] }))).toBeUndefined();
  });
});
