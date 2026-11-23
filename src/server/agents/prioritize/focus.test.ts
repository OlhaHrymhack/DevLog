import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DayPlanSchema } from "@/entities/agentRun";
import { createTaskRepository } from "../../tasks/repository";
import { createTestDb, NOW, type TestDb } from "../core/__tests__/echoAgent";
import { rulePlan } from "./rulePlan";

let db: TestDb;
let repository: ReturnType<typeof createTaskRepository>;

beforeEach(async () => {
  db = await createTestDb();
  repository = createTaskRepository(db.connection.db);
});

afterEach(() => {
  db.connection.close();
});

const focus = async () => Object.fromEntries((await repository.listTasks())
  .filter((task) => task.focusRank !== null).map((task) => [task.id, task.focusRank]));

describe("фокус дня після плану агента", () => {
  it("DEV-009 AC-5: повторне застосування замінює фокус, а статуси й пріоритети не змінюються", async () => {
    const before = (await repository.listTasks()).map((task) => [task.id, task.status, task.priority]);
    await repository.setFocus(rulePlan(await repository.listTasks(), NOW).items.map((item) => item.taskId));
    expect(await focus()).toEqual({ t2: 1, t7: 2, t1: 3 });

    await repository.setFocus(["t1", "t2"]);
    expect(await focus()).toEqual({ t1: 1, t2: 2 });
    expect((await repository.listTasks()).map((task) => [task.id, task.status, task.priority])).toEqual(before);
  });

  it("DEV-009 AC-5: видалення задачі з фокусу прибирає її бейдж, решта фокусу лишається", async () => {
    await repository.setFocus(["t2", "t7", "t1"]);
    await repository.deleteTask("t7");
    expect(await focus()).toEqual({ t2: 1, t1: 3 });
    expect((await repository.listTasks()).some((task) => task.id === "t7")).toBe(false);
  });

  it("DEV-009 AC-5: неіснуюча задача у фокусі відхиляється без зміни наявного фокусу", async () => {
    await repository.setFocus(["t2"]);
    await expect(repository.setFocus(["t1", "42"])).rejects.toThrow();
    expect(await focus()).toEqual({ t2: 1 });
  });

  it("DEV-009 AC-4: fallback-план проходить схему DayPlan (1…3 у плані); без активних задач він порожній — агент тоді не запускається", async () => {
    const all = await repository.listTasks();
    expect(DayPlanSchema.safeParse(rulePlan(all, NOW)).success).toBe(true);
    expect(DayPlanSchema.safeParse(rulePlan(all.filter((task) => task.id === "t2"), NOW)).success).toBe(true);
    expect(rulePlan(all.filter((task) => task.status === "done"), NOW).items).toEqual([]);
  });

  it("DEV-009 AC-4: термінова задача з низьким пріоритетом потрапляє в fallback поряд з терміновою t2, попереду нетермінових", async () => {
    const urgent = await repository.createTask({
      title: "Термінова дрібниця", description: "Потрібно зробити до завтра", priority: "low", status: "todo",
      dueAt: new Date(NOW.getTime() + 3_600_000).toISOString(),
    }, NOW);
    expect(rulePlan(await repository.listTasks(), NOW).items.slice(0, 2).map((item) => item.taskId)).toEqual(["t2", urgent.id]);
  });
});
