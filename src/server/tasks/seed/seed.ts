import "server-only";
import { MS_PER_DAY, MS_PER_HOUR } from "@/shared/lib/timestamp";
import { createId } from "../../ids";
import type { DbExecutor } from "../../db/client";
import { SEED_TASKS } from "./data";
import { notes, subtasks, tasks } from "../schema";
import { toSearchText } from "../searchText";

/** Вставляє синтетичні задачі. Викликати в транзакції: часткового засівання не буває. */
export const insertSeedTasks = async (db: DbExecutor, now: Date): Promise<number> => {
  const timestamp = now.getTime();
  const daysAgo = (days: number) => new Date(timestamp - days * MS_PER_DAY).toISOString();

  for (const fixture of SEED_TASKS) {
    const { createdDaysAgo, updatedDaysAgo, dueInHours, subtasks: children, notes: taskNotes, ...task } = fixture;
    const createdAt = daysAgo(createdDaysAgo);
    const updatedAt = daysAgo(updatedDaysAgo);
    const dueAt = dueInHours === undefined ? null : new Date(timestamp + dueInHours * MS_PER_HOUR).toISOString();

    await db.insert(tasks).values({
      ...task, createdAt, updatedAt, dueAt, focusRank: null, searchText: toSearchText(task.title, task.description),
    }).run();

    if (children.length) {
      await db.insert(subtasks).values(children.map((subtask, position): typeof subtasks.$inferInsert => ({
        ...subtask, id: createId(), taskId: task.id, position, source: "user",
        createdAt: subtask.status === "done" ? updatedAt : createdAt,
      }))).run();
    }

    if (taskNotes.length) {
      await db.insert(notes).values(taskNotes.map(({ text, daysAgo: noteDaysAgo }) => ({
        id: createId(), taskId: task.id, text, createdAt: daysAgo(noteDaysAgo),
      }))).run();
    }
  }

  return SEED_TASKS.length;
};

/** Замінює всі задачі фікстурами (підзадачі й нотатки видаляє каскад). */
export const seedTasks = async (db: DbExecutor, now: Date): Promise<number> => {
  await db.delete(tasks).run();
  return insertSeedTasks(db, now);
};
