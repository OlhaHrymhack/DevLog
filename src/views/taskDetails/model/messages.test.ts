import { describe, expect, it } from "vitest";
import { getHeat, type Task } from "@/entities/task";
import { allSubtasksDoneMessage, priorityChangedMessage, statusChangedMessage } from "./messages";

const NOW = Date.parse("2026-11-22T12:00:00.000Z");
const task = (overrides: Partial<Task>): Task => ({
  id: "t1", title: "Задача", description: "Опис задачі", status: "in-progress", priority: "high",
  createdAt: "2026-11-01T10:00:00.000Z", updatedAt: "2026-11-01T10:00:00.000Z", dueAt: null,
  focusRank: null, subtasks: [], notes: [], ...overrides,
});

describe("повідомлення сторінки деталей", () => {
  const fresh = task({ status: "todo", updatedAt: "2026-11-22T10:00:00.000Z", createdAt: "2026-11-22T09:00:00.000Z" });
  const hot = task({});

  it("DEV-007 AC-2: перехід todo → in-progress дає «Статус: …»", () => {
    expect(statusChangedMessage(fresh, { ...fresh, status: "in-progress" }, false, NOW)).toBe("Статус: В роботі");
  });

  it("DEV-007 AC-2: закриття свіжої задачі — без жартів про пожежу", () => {
    expect(getHeat(fresh, NOW).rank).toBeLessThan(2);
    expect(statusChangedMessage(fresh, { ...fresh, status: "done" }, false, NOW)).toBe("Статус: Готово");
  });

  it("DEV-007 AC-2: закриття гарячої задачі дає окреме повідомлення за режимом", () => {
    expect(getHeat(hot, NOW).rank).toBeGreaterThanOrEqual(2);
    expect(statusChangedMessage(hot, { ...hot, status: "done" }, false, NOW)).toContain("Пожежу загашено");
    expect(statusChangedMessage(hot, { ...hot, status: "done" }, true, NOW)).toBe("Задачу закрито");
  });

  it("DEV-007 AC-2: пріоритет і підзадачі", () => {
    expect(priorityChangedMessage({ priority: "high" })).toBe("Пріоритет: Високий");
    expect(allSubtasksDoneMessage(true)).toBe("Усі підзадачі готові. Можна закривати задачу");
    expect(allSubtasksDoneMessage(false)).toContain("Усі підзадачі готові");
  });
});
