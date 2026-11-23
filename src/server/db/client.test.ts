import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { createDb } from "./client";
import { AGENT_RUN_DB_ENUMS } from "../agentRuns/schema";
import { TASK_DB_ENUMS } from "../tasks/schema";
import {
  AgentRunKindSchema, AgentRunModeSchema, AgentRunStatusSchema, AgentStepRecordStateSchema, AgentStepTypeSchema,
} from "@/entities/agentRun";
import { SubtaskSourceSchema, TaskPrioritySchema, TaskStatusSchema } from "@/entities/task";

afterEach(() => vi.unstubAllEnvs());

test("DEV-003 AC-1: SQLite creates and reopens a migrated file, and getDb reuses the connection", async () => {
  const root = mkdtempSync(join(tmpdir(), "devlog-db-test-"));
  const file = join(root, "nested", "devlog.db");
  try {
    const connection = createDb(`file:${file}`);
    try {
      expect(existsSync(file)).toBe(true);
      expect(connection.sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
      expect(connection.sqlite.pragma("journal_mode", { simple: true })).toBe("wal");
      const objects = connection.sqlite.prepare("select name from sqlite_master").pluck().all();
      expect(objects).toEqual(expect.arrayContaining([
        "tasks", "subtasks", "notes", "agent_runs", "agent_steps",
        "tasks_status_idx", "subtasks_task_id_idx", "notes_task_id_idx", "agent_steps_run_id_idx",
      ]));
    } finally {
      connection.close();
    }

    vi.stubEnv("DATABASE_URL", file);
    vi.resetModules();
    const { getDb } = await import("./client");
    const reopened = getDb();
    try {
      expect(getDb()).toBe(reopened);
      expect(reopened.sqlite.prepare("select count(*) from __drizzle_migrations").pluck().get()).toBe(1);
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("DEV-003 AC-3: SQLite enums match the Zod contracts and reject unknown statuses", () => {
  expect({ ...TASK_DB_ENUMS, ...AGENT_RUN_DB_ENUMS }).toEqual({
    taskStatus: TaskStatusSchema.options, priority: TaskPrioritySchema.options,
    source: SubtaskSourceSchema.options, runKind: AgentRunKindSchema.options,
    runStatus: AgentRunStatusSchema.options, mode: AgentRunModeSchema.options,
    stepType: AgentStepTypeSchema.options, stepState: AgentStepRecordStateSchema.options,
  });
  const connection = createDb(":memory:");
  try {
    expect(() => connection.sqlite.prepare(
      "insert into tasks (id, title, description, status, priority, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)",
    ).run("x", "Title", "Description", "blocked", "low", "now", "now")).toThrow(/CHECK/);
  } finally {
    connection.close();
  }
});
