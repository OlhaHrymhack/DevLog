import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { oneOf } from "../db/checks";

export const TASK_DB_ENUMS = {
  taskStatus: ["todo", "in-progress", "done"],
  priority: ["low", "medium", "high"],
  source: ["user", "ai"],
} as const;

export const tasks = sqliteTable("tasks", {
  id: text().primaryKey(),
  title: text().notNull(),
  description: text().notNull(),
  status: text({ enum: TASK_DB_ENUMS.taskStatus }).notNull(),
  priority: text({ enum: TASK_DB_ENUMS.priority }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  dueAt: text("due_at"),
  focusRank: integer("focus_rank"),
}, (table) => [
  index("tasks_status_idx").on(table.status),
  check("tasks_status_check", oneOf(table.status, TASK_DB_ENUMS.taskStatus)),
  check("tasks_priority_check", oneOf(table.priority, TASK_DB_ENUMS.priority)),
]);

export const subtasks = sqliteTable("subtasks", {
  id: text().primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  title: text().notNull(),
  status: text({ enum: TASK_DB_ENUMS.taskStatus }).notNull(),
  source: text({ enum: TASK_DB_ENUMS.source }).notNull(),
  estimate: text(),
  rationale: text(),
  position: integer().notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("subtasks_task_id_idx").on(table.taskId),
  check("subtasks_status_check", oneOf(table.status, TASK_DB_ENUMS.taskStatus)),
  check("subtasks_source_check", oneOf(table.source, TASK_DB_ENUMS.source)),
]);

export const notes = sqliteTable("notes", {
  id: text().primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  text: text().notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("notes_task_id_idx").on(table.taskId)]);
