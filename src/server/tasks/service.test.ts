import { expect, test } from "vitest";
import { createDb } from "../db/client";
import { createTaskService } from "./service";

test("DEV-003 AC-4: activity updates the parent timestamp, while due date and focus do not", async () => {
  const connection = await createDb(":memory:");
  let now = new Date("2026-11-21T12:00:00Z");
  const service = createTaskService({ db: connection.db, clock: () => now });
  try {
    const task = await service.createTask({ title: "Check activity", description: "Track meaningful changes." });
    const advance = () => { now = new Date(now.getTime() + 60_000); };
    const expectActivity = async () => {
      expect(await service.getTask(task.id)).toMatchObject({ createdAt: task.createdAt, updatedAt: now.toISOString() });
    };
    advance();
    await service.updateTask(task.id, { status: "in-progress" });
    await expectActivity();
    const statusChangedAt = now.toISOString();
    advance();
    await service.updateTask(task.id, { title: task.title, dueAt: "2026-11-23T14:00:00+02:00" });
    await service.setFocus([task.id]);
    expect(await service.getTask(task.id)).toMatchObject({
      createdAt: task.createdAt, updatedAt: statusChangedAt, focusRank: 1, dueAt: "2026-11-23T12:00:00.000Z",
    });
    const subtask = (await service.addSubtasks(task.id, [{ title: "Write a test", source: "ai" }]))?.[0];
    if (!subtask) throw new Error("Expected a new subtask");
    await expectActivity();
    advance();
    await service.updateSubtask(task.id, subtask.id, { status: "done" });
    await expectActivity();
    advance();
    await service.deleteSubtask(task.id, subtask.id);
    await expectActivity();
    advance();
    await service.addNote(task.id, { text: "Review complete" });
    await expectActivity();
    expect(await service.updateTask("missing", { status: "done" })).toBeNull();
  } finally {
    connection.close();
  }
});
