import { expect, test } from "vitest";
import { createDb } from "../db/client";
import { createTaskService } from "./service";

test("DEV-003 AC-4: activity updates the parent timestamp, while due date and focus do not", () => {
  const connection = createDb(":memory:");
  let now = new Date("2026-11-21T12:00:00Z");
  const service = createTaskService({ db: connection.db, clock: () => now });
  try {
    const task = service.createTask({ title: "Check activity", description: "Track meaningful changes." });
    const advance = () => { now = new Date(now.getTime() + 60_000); };
    const expectActivity = () => {
      expect(service.getTask(task.id)).toMatchObject({ createdAt: task.createdAt, updatedAt: now.toISOString() });
    };
    advance();
    service.updateTask(task.id, { status: "in-progress" });
    expectActivity();
    const statusChangedAt = now.toISOString();
    advance();
    service.updateTask(task.id, { title: task.title, dueAt: "2026-11-23T14:00:00+02:00" });
    service.setFocus([task.id]);
    expect(service.getTask(task.id)).toMatchObject({
      createdAt: task.createdAt, updatedAt: statusChangedAt, focusRank: 1, dueAt: "2026-11-23T12:00:00.000Z",
    });
    const subtask = service.addSubtasks(task.id, [{ title: "Write a test", source: "ai" }])?.[0];
    if (!subtask) throw new Error("Expected a new subtask");
    expectActivity();
    advance();
    service.updateSubtask(task.id, subtask.id, { status: "done" });
    expectActivity();
    advance();
    service.deleteSubtask(task.id, subtask.id);
    expectActivity();
    advance();
    service.addNote(task.id, { text: "Review complete" });
    expectActivity();
  } finally {
    connection.close();
  }
});
