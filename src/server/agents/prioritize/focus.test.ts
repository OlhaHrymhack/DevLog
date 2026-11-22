import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DayPlanSchema } from "@/entities/agentRun";
import { createTaskRepository } from "../../tasks/repository";
import { createTestDb, NOW } from "../core/__tests__/echoAgent";
import { rulePlan } from "./rulePlan";

let db: ReturnType<typeof createTestDb>;
let repository: ReturnType<typeof createTaskRepository>;

beforeEach(() => {
  db = createTestDb();
  repository = createTaskRepository(db.connection.db);
});

afterEach(() => {
  db.connection.close();
});

const focus = () => Object.fromEntries(repository.listTasks()
  .filter((task) => task.focusRank !== null).map((task) => [task.id, task.focusRank]));

describe("фокус дня після плану агента", () => {
  it("DEV-009 AC-5: повторне застосування замінює фокус, а статуси й пріоритети не змінюються", () => {
    const before = repository.listTasks().map((task) => [task.id, task.status, task.priority]);
    repository.setFocus(rulePlan(repository.listTasks(), NOW).items.map((item) => item.taskId));
    expect(focus()).toEqual({ t2: 1, t7: 2, t1: 3 });

    repository.setFocus(["t1", "t2"]);
    expect(focus()).toEqual({ t1: 1, t2: 2 });
    expect(repository.listTasks().map((task) => [task.id, task.status, task.priority])).toEqual(before);
  });

  it("DEV-009 AC-5: видалення задачі з фокусу прибирає її бейдж, решта фокусу лишається", () => {
    repository.setFocus(["t2", "t7", "t1"]);
    repository.deleteTask("t7");
    expect(focus()).toEqual({ t2: 1, t1: 3 });
    expect(repository.listTasks().some((task) => task.id === "t7")).toBe(false);
  });

  it("DEV-009 AC-5: неіснуюча задача у фокусі відхиляється без зміни наявного фокусу", () => {
    repository.setFocus(["t2"]);
    expect(() => repository.setFocus(["t1", "42"])).toThrow();
    expect(focus()).toEqual({ t2: 1 });
  });

  it("DEV-009 AC-4: fallback-план проходить схему DayPlan (1…3 у плані); без активних задач він порожній — агент тоді не запускається", () => {
    const all = repository.listTasks();
    expect(DayPlanSchema.safeParse(rulePlan(all, NOW)).success).toBe(true);
    expect(DayPlanSchema.safeParse(rulePlan(all.filter((task) => task.id === "t2"), NOW)).success).toBe(true);
    expect(rulePlan(all.filter((task) => task.status === "done"), NOW).items).toEqual([]);
  });

  it("DEV-009 AC-4: термінова задача з низьким пріоритетом потрапляє в fallback поряд з терміновою t2, попереду нетермінових", () => {
    const urgent = repository.createTask({
      title: "Термінова дрібниця", description: "Потрібно зробити до завтра", priority: "low", status: "todo",
      dueAt: new Date(NOW.getTime() + 3_600_000).toISOString(),
    }, NOW);
    expect(rulePlan(repository.listTasks(), NOW).items.slice(0, 2).map((item) => item.taskId)).toEqual(["t2", urgent.id]);
  });
});
