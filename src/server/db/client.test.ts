import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle as drizzleBetterSqlite } from "drizzle-orm/better-sqlite3";
import { migrate as migrateBetterSqlite } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, expect, test, vi } from "vitest";
import { createDb, MIGRATIONS_FOLDER, parseDatabaseUrl } from "./client";
import { AGENT_RUN_DB_ENUMS } from "../agentRuns/schema";
import { createTaskRepository } from "../tasks/repository";
import { TASK_DB_ENUMS } from "../tasks/schema";
import {
  AgentRunKindSchema, AgentRunModeSchema, AgentRunStatusSchema, AgentStepRecordStateSchema, AgentStepTypeSchema,
} from "@/entities/agentRun";
import { SubtaskSourceSchema, TaskPrioritySchema, TaskStatusSchema } from "@/entities/task";

afterEach(() => vi.unstubAllEnvs());

const tempDir = (prefix: string) => mkdtempSync(join(tmpdir(), prefix));

test("DEV-003 AC-1: SQLite creates and reopens a migrated file, and getDb reuses the connection", async () => {
  const root = tempDir("devlog-db-test-");
  const file = join(root, "nested", "devlog.db");
  try {
    const connection = await createDb(`file:${file}`);
    try {
      expect(existsSync(file)).toBe(true);
      expect((await connection.client.execute("pragma foreign_keys")).rows[0]?.foreign_keys).toBe(1);
      expect((await connection.client.execute("pragma journal_mode")).rows[0]?.journal_mode).toBe("wal");
      const objects = (await connection.client.execute("select name from sqlite_master")).rows.map((row) => row.name);
      expect(objects).toEqual(expect.arrayContaining([
        "tasks", "subtasks", "notes", "agent_runs", "agent_steps", "agent_quotas",
        "tasks_status_idx", "subtasks_task_id_idx", "notes_task_id_idx", "agent_steps_run_id_idx",
      ]));
    } finally {
      connection.close();
    }

    vi.stubEnv("DATABASE_URL", file);
    vi.resetModules();
    const { getDb } = await import("./client");
    const pending = getDb();
    const reopened = await pending;
    try {
      expect(getDb()).toBe(pending);
      expect((await reopened.client.execute("select count(*) as n from __drizzle_migrations")).rows[0]?.n).toBe(2);
    } finally {
      reopened.close();
    }
    expect(getDb()).not.toBe(pending);
    (await getDb()).close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("DEV-003 AC-3: SQLite enums match the Zod contracts and reject unknown statuses", async () => {
  expect({ ...TASK_DB_ENUMS, ...AGENT_RUN_DB_ENUMS }).toEqual({
    taskStatus: TaskStatusSchema.options, priority: TaskPrioritySchema.options,
    source: SubtaskSourceSchema.options, runKind: AgentRunKindSchema.options,
    runStatus: AgentRunStatusSchema.options, mode: AgentRunModeSchema.options,
    stepType: AgentStepTypeSchema.options, stepState: AgentStepRecordStateSchema.options,
  });
  const connection = await createDb(":memory:");
  try {
    await expect(connection.client.execute({
      sql: "insert into tasks (id, title, description, status, priority, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)",
      args: ["x", "Title", "Description", "blocked", "low", "now", "now"],
    })).rejects.toThrow(/CHECK/);
    await expect(connection.client.execute("insert into agent_quotas (kind, used, updated_at) values ('smoke', 0, 'now')"))
      .rejects.toThrow(/CHECK/);
  } finally {
    connection.close();
  }
});

test("DEV-017 AC-3: DATABASE_URL picks a local file, memory or remote libSQL", () => {
  expect(parseDatabaseUrl(":memory:")).toEqual({ kind: "memory" });
  expect(parseDatabaseUrl("file::memory:")).toEqual({ kind: "memory" });
  expect(parseDatabaseUrl("file:./data/devlog.db")).toMatchObject({ kind: "file" });
  expect(parseDatabaseUrl("./data/devlog.db")).toMatchObject({ kind: "file" });
  for (const url of ["libsql://demo.turso.io", "https://demo.turso.io", "http://127.0.0.1:8080", "wss://demo.turso.io"]) {
    expect(parseDatabaseUrl(url)).toEqual({ kind: "remote", url });
  }
});

/** Файл, створений до DEV-017: драйвер better-sqlite3, лише міграція 0000, задачі без `search_text`. */
const createLegacyFile = (root: string) => {
  const legacyMigrations = join(root, "migrations");
  mkdirSync(join(legacyMigrations, "meta"), { recursive: true });
  copyFileSync(join(MIGRATIONS_FOLDER, "0000_fearless_gamma_corps.sql"), join(legacyMigrations, "0000_fearless_gamma_corps.sql"));
  writeFileSync(join(legacyMigrations, "meta", "_journal.json"), JSON.stringify({
    version: "7", dialect: "sqlite",
    entries: [{ idx: 0, version: "6", when: 1795345589163, tag: "0000_fearless_gamma_corps", breakpoints: true }],
  }));
  const file = join(root, "legacy # %25.db");
  const sqlite = new Database(file);
  try {
    sqlite.pragma("journal_mode = WAL");
    migrateBetterSqlite(drizzleBetterSqlite(sqlite), { migrationsFolder: legacyMigrations });
    sqlite.prepare("insert into tasks (id, title, description, status, priority, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)")
      .run("old1", "Виправити витік ПАМ’яті", "Старий запис до DEV-017", "in-progress", "high", "2026-11-01T00:00:00.000Z", "2026-11-02T00:00:00.000Z");
    sqlite.prepare("insert into subtasks (id, task_id, title, status, source, position, created_at) values (?, ?, ?, ?, ?, ?, ?)")
      .run("old1-s", "old1", "Зняти heap snapshot", "done", "user", 0, "2026-11-01T00:00:00.000Z");
  } finally {
    sqlite.close();
  }
  return file;
};

test("DEV-017 AC-3: an existing pre-libSQL file opens, keeps its data, applies only the new migration and becomes searchable", async () => {
  const root = tempDir("devlog-legacy-");
  try {
    const file = createLegacyFile(root);
    const connection = await createDb(file);
    try {
      const repository = createTaskRepository(connection.db);
      expect((await connection.client.execute("select count(*) as n from __drizzle_migrations")).rows[0]?.n).toBe(2);
      expect(await repository.getTask("old1")).toMatchObject({ title: "Виправити витік ПАМ’яті", subtasks: [{ id: "old1-s" }] });
      expect((await repository.listTasks({ q: "пам’ят" })).map((task) => task.id)).toEqual(["old1"]);
      expect((await connection.client.execute("select search_text from tasks where id = 'old1'")).rows[0]?.search_text)
        .toBe("виправити витік пам’яті старий запис до dev-017");
      expect(await repository.deleteTask("old1")).toBe(true);
      expect((await connection.client.execute("select count(*) as n from subtasks")).rows[0]?.n).toBe(0);
    } finally {
      connection.close();
    }

    const again = await createDb(file);
    try {
      expect((await again.client.execute("select count(*) as n from __drizzle_migrations")).rows[0]?.n).toBe(2);
    } finally {
      again.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
