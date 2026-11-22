import { describe, expect, it } from "vitest";
import { areAllSubtasksDone, getSubtaskProgress } from "./subtaskProgress";

const subtasks = (...statuses: ("todo" | "in-progress" | "done")[]) => statuses.map((status) => ({ status }));

describe("subtaskProgress", () => {
  it("DEV-007 AC-3: прогрес = round(done / all × 100)", () => {
    expect(getSubtaskProgress(subtasks("done", "todo", "todo"))).toEqual({ done: 1, total: 3, percent: 33 });
    expect(getSubtaskProgress(subtasks("done", "done", "todo"))).toEqual({ done: 2, total: 3, percent: 67 });
    expect(getSubtaskProgress(subtasks("done", "done"))).toEqual({ done: 2, total: 2, percent: 100 });
  });

  it("DEV-007 AC-3: без підзадач прогрес 0 %", () => {
    expect(getSubtaskProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
  });

  it("DEV-007 AC-3: «усі готові» лише для непорожнього списку з done", () => {
    expect(areAllSubtasksDone([])).toBe(false);
    expect(areAllSubtasksDone(subtasks("done", "in-progress"))).toBe(false);
    expect(areAllSubtasksDone(subtasks("done", "done"))).toBe(true);
  });
});
