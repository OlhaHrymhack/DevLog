import { expect, it } from "vitest";
import type { Task } from "@/entities/task";
import { getTaskPatch, taskUpdatedMessage } from "./taskPatch";

const NOW = Date.parse("2026-11-22T12:00:00Z");
const hotTask: Task = {
  id: "test-task",
  title: "Виправити проблему",
  description: "Відновити роботу сервісу.",
  status: "in-progress",
  priority: "high",
  createdAt: "2026-11-05T12:00:00Z",
  updatedAt: "2026-11-15T12:00:00Z",
  dueAt: "2026-11-22T13:00:00Z",
  focusRank: null,
  subtasks: [],
  notes: [],
};

it("DEV-006 AC-4: only changed editable fields go to PATCH", () => {
  expect(getTaskPatch(hotTask, hotTask)).toBeUndefined();
  expect(getTaskPatch(hotTask, { ...hotTask, priority: "low", status: "done" })).toEqual({
    priority: "low", status: "done",
  });
});

it("DEV-006 AC-4: closing a hot task has a distinct toast and respects serious mode", () => {
  const closed: Task = { ...hotTask, status: "done" };
  expect(taskUpdatedMessage(hotTask, closed, false, NOW)).toContain("Пожежу загашено");
  expect(taskUpdatedMessage(hotTask, closed, true, NOW)).toBe("Задачу закрито");
  expect(taskUpdatedMessage(hotTask, hotTask, false, NOW)).toBe("Зміни збережено");
});
