import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { oneOf } from "../db/checks";
import { tasks } from "../tasks/schema";

export const AGENT_RUN_DB_ENUMS = {
  runKind: ["prioritize", "decompose", "status-update", "stuck-radar"],
  runStatus: ["running", "result", "clarify", "fallback", "stopped", "error"],
  mode: ["live", "demo"],
  stepType: ["model", "tool", "validation"],
  stepState: ["done", "fail"],
} as const;

export const agentRuns = sqliteTable("agent_runs", {
  id: text().primaryKey(),
  kind: text({ enum: AGENT_RUN_DB_ENUMS.runKind }).notNull(),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
  status: text({ enum: AGENT_RUN_DB_ENUMS.runStatus }).notNull(),
  mode: text({ enum: AGENT_RUN_DB_ENUMS.mode }).notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  resultJson: text("result_json", { mode: "json" }).$type<unknown>(),
  errorJson: text("error_json", { mode: "json" }).$type<unknown>(),
}, (table) => [
  check("agent_runs_kind_check", oneOf(table.kind, AGENT_RUN_DB_ENUMS.runKind)),
  check("agent_runs_status_check", oneOf(table.status, AGENT_RUN_DB_ENUMS.runStatus)),
  check("agent_runs_mode_check", oneOf(table.mode, AGENT_RUN_DB_ENUMS.mode)),
]);

export const agentSteps = sqliteTable("agent_steps", {
  id: text().primaryKey(),
  runId: text("run_id").notNull().references(() => agentRuns.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  type: text({ enum: AGENT_RUN_DB_ENUMS.stepType }).notNull(),
  label: text().notNull(),
  state: text({ enum: AGENT_RUN_DB_ENUMS.stepState }).notNull(),
  detail: text(),
  payloadJson: text("payload_json", { mode: "json" }).$type<unknown>(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("agent_steps_run_id_idx").on(table.runId),
  check("agent_steps_type_check", oneOf(table.type, AGENT_RUN_DB_ENUMS.stepType)),
  check("agent_steps_state_check", oneOf(table.state, AGENT_RUN_DB_ENUMS.stepState)),
]);
