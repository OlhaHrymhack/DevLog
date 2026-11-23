import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAgentQuotaRepository } from "../agentQuota/repository";
import { createTaskRepository } from "../tasks/repository";
import { createDb } from "./client";
import { DbCommandError, runDbCommand } from "./operations";

const NOW = new Date("2026-11-21T12:00:00Z");
const REMOTE = { url: "libsql://devlog-production.example.turso.io", authToken: "not-a-real-token" };

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "devlog-ops-"));
  file = join(dir, "devlog.db");
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("операції з БД поза стартом застосунку", () => {
  it("DEV-017 AC-3: db:seed відмовляється працювати з віддаленою (production) базою ще до підключення", async () => {
    await expect(runDbCommand("seed", REMOTE, NOW)).rejects.toBeInstanceOf(DbCommandError);
    await expect(runDbCommand("seed", REMOTE, NOW)).rejects.toThrow(/локальним SQLite/);
  });

  it("DEV-017 AC-3: db:seed:remote не застосовується до локального файла", async () => {
    await expect(runDbCommand("seed-remote", { url: file }, NOW)).rejects.toBeInstanceOf(DbCommandError);
  });

  it("DEV-017 AC-3: migrate ідемпотентний, а локальний seed замінює задачі, але не скидає квоту", async () => {
    expect(await runDbCommand("migrate", { url: file }, NOW)).toEqual({ command: "migrate", remote: false });
    expect(await runDbCommand("migrate", { url: file }, NOW)).toEqual({ command: "migrate", remote: false });
    expect(await runDbCommand("seed", { url: file }, NOW)).toEqual({ command: "seed", remote: false, tasks: 12 });

    const connection = await createDb(file);
    try {
      await createAgentQuotaRepository(connection.db).reserve("prioritize");
      await createTaskRepository(connection.db).deleteTask("t1");
    } finally {
      connection.close();
    }
    expect(await runDbCommand("seed", { url: file }, NOW)).toMatchObject({ tasks: 12 });
    const reopened = await createDb(file);
    try {
      expect(await createTaskRepository(reopened.db).getTask("t1")).not.toBeNull();
      expect(await createAgentQuotaRepository(reopened.db).getUsage("prioritize")).toBe(1);
    } finally {
      reopened.close();
    }
  });
});
