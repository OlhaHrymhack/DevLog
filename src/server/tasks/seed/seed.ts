import "server-only";
import { MS_PER_DAY, MS_PER_HOUR } from "@/shared/lib/timestamp";
import { createId } from "../../ids";
import type { DevLogDb } from "../../db/client";
import { SEED_TASKS } from "./data";
import { notes, subtasks, tasks } from "../schema";

export const seedTasks = (db: Pick<DevLogDb, "delete" | "insert">, now: Date): number => {
  const timestamp = now.getTime();
  const daysAgo = (days: number) => new Date(timestamp - days * MS_PER_DAY).toISOString();

  db.delete(tasks).run();

  for (const fixture of SEED_TASKS) {
    const { createdDaysAgo, updatedDaysAgo, dueInHours, subtasks: children, notes: taskNotes, ...task } = fixture;
    const createdAt = daysAgo(createdDaysAgo);
    const updatedAt = daysAgo(updatedDaysAgo);
    const dueAt = dueInHours === undefined ? null : new Date(timestamp + dueInHours * MS_PER_HOUR).toISOString();

    db.insert(tasks).values({ ...task, createdAt, updatedAt, dueAt, focusRank: null }).run();

    if (children.length) {
      db.insert(subtasks).values(children.map((subtask, position): typeof subtasks.$inferInsert => ({
        ...subtask, id: createId(), taskId: task.id, position, source: "user",
        createdAt: subtask.status === "done" ? updatedAt : createdAt,
      }))).run();
    }

    if (taskNotes.length) {
      db.insert(notes).values(taskNotes.map(({ text, daysAgo: noteDaysAgo }) => ({
        id: createId(), taskId: task.id, text, createdAt: daysAgo(noteDaysAgo),
      }))).run();
    }
  }

  return SEED_TASKS.length;
};
