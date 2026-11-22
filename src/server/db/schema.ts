import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, type SQLiteColumn } from "drizzle-orm/sqlite-core";

// Drizzle Kit loads the schema outside Next without loading entity UI barrels.
export const DB_ENUMS = {
  taskStatus: ["todo", "in-progress", "done"],
  priority: ["low", "medium", "high"],
  source: ["user", "ai"],
  runKind: ["prioritize", "decompose", "status-update", "stuck-radar"],
  runStatus: ["running", "result", "clarify", "fallback", "stopped", "error"],
  mode: ["live", "demo"],
  stepType: ["model", "tool", "validation"],
  stepState: ["done", "fail"],
} as const;

const oneOf = (column: SQLiteColumn, values: readonly string[]) =>
  sql`${column} in (${sql.join(values.map((value) => sql.raw("'" + value.replaceAll("'", "''") + "'")), sql`, `)})`;

export const tasks = sqliteTable("tasks", {
  id: text().primaryKey(),
  title: text().notNull(),
  description: text().notNull(),
  status: text({ enum: DB_ENUMS.taskStatus }).notNull(),
  priority: text({ enum: DB_ENUMS.priority }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  dueAt: text("due_at"),
  focusRank: integer("focus_rank"),
}, (table) => [
  index("tasks_status_idx").on(table.status),
  check("tasks_status_check", oneOf(table.status, DB_ENUMS.taskStatus)),
  check("tasks_priority_check", oneOf(table.priority, DB_ENUMS.priority)),
]);

export const subtasks = sqliteTable("subtasks", {
  id: text().primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  title: text().notNull(),
  status: text({ enum: DB_ENUMS.taskStatus }).notNull(),
  source: text({ enum: DB_ENUMS.source }).notNull(),
  estimate: text(),
  rationale: text(),
  position: integer().notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("subtasks_task_id_idx").on(table.taskId),
  check("subtasks_status_check", oneOf(table.status, DB_ENUMS.taskStatus)),
  check("subtasks_source_check", oneOf(table.source, DB_ENUMS.source)),
]);

export const notes = sqliteTable("notes", {
  id: text().primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  text: text().notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("notes_task_id_idx").on(table.taskId)]);

export const agentRuns = sqliteTable("agent_runs", {
  id: text().primaryKey(),
  kind: text({ enum: DB_ENUMS.runKind }).notNull(),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
  status: text({ enum: DB_ENUMS.runStatus }).notNull(),
  mode: text({ enum: DB_ENUMS.mode }).notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  resultJson: text("result_json", { mode: "json" }).$type<unknown>(),
  errorJson: text("error_json", { mode: "json" }).$type<unknown>(),
}, (table) => [
  check("agent_runs_kind_check", oneOf(table.kind, DB_ENUMS.runKind)),
  check("agent_runs_status_check", oneOf(table.status, DB_ENUMS.runStatus)),
  check("agent_runs_mode_check", oneOf(table.mode, DB_ENUMS.mode)),
]);

export const agentSteps = sqliteTable("agent_steps", {
  id: text().primaryKey(),
  runId: text("run_id").notNull().references(() => agentRuns.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  type: text({ enum: DB_ENUMS.stepType }).notNull(),
  label: text().notNull(),
  state: text({ enum: DB_ENUMS.stepState }).notNull(),
  detail: text(),
  payloadJson: text("payload_json", { mode: "json" }).$type<unknown>(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("agent_steps_run_id_idx").on(table.runId),
  check("agent_steps_type_check", oneOf(table.type, DB_ENUMS.stepType)),
  check("agent_steps_state_check", oneOf(table.state, DB_ENUMS.stepState)),
]);
