import { describe, expect, it } from "vitest";
import type { Triage } from "@/entities/agentRun";
import type { TaskListItem } from "@/entities/task";
import { resolveCards } from "./resolveCards";

const NOW = new Date("2026-11-22T12:00:00.000Z");
const task = (id: string, overrides: Partial<TaskListItem> = {}): TaskListItem => ({
  id, title: `Задача ${id}`, description: "Опис задачі для тесту.", status: "in-progress", priority: "medium",
  createdAt: "2026-11-01T10:00:00.000Z", updatedAt: "2026-11-17T12:00:00.000Z", dueAt: null, focusRank: null,
  subtaskCount: 0, subtaskDone: 0, ...overrides,
});
const triage: Triage = {
  items: [
    { taskId: "a", cause: "vague", why: "Немає ні підзадач, ні нотаток.", action: "split", draft: null },
    { taskId: "b", cause: "no-activity", why: "Задача давно не оновлювалась.", action: "open", draft: null },
    { taskId: "c", cause: "no-activity", why: "Задача давно не оновлювалась.", action: "open", draft: null },
  ],
};

describe("resolveCards", () => {
  it("DEV-012 AC-7: відкладені, відсутні й уже не «в роботі» задачі ховаються без повторного сканування", () => {
    const tasks = [task("a"), task("b", { status: "done" }), task("c")];
    expect(resolveCards(triage, tasks, [], NOW).map((card) => card.item.taskId)).toEqual(["a", "c"]);
    expect(resolveCards(triage, tasks, ["a"], NOW).map((card) => card.item.taskId)).toEqual(["c"]);
    expect(resolveCards(triage, [task("a")], [], NOW).map((card) => card.item.taskId)).toEqual(["a"]);
  });

  it("DEV-012 AC-2: картка має назву й повні доби без змін", () => {
    const [card] = resolveCards(triage, [task("a")], [], NOW);
    expect(card).toMatchObject({ title: "Задача a", staleDays: 5 });
  });

  it("DEV-012 AC-8: невалідні дані → порожній список замість падіння", () => {
    expect(resolveCards({ items: "x" }, [task("a")], [], NOW)).toEqual([]);
    expect(resolveCards({ items: [] }, [task("a")], [], NOW)).toEqual([]);
  });
});
