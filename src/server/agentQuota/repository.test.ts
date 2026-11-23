import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { createDb, migrateDatabase } from "../db/client";
import { seedDatabase } from "../db/seed";
import { AGENT_RUN_QUOTA, createAgentQuotaRepository } from "./repository";

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "devlog-quota-"));
  file = join(dir, "quota.db");
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

test("DEV-017 AC-4: 24 parallel reservations over independent connections reserve exactly 10, per agent", async () => {
  const connections = await Promise.all(Array.from({ length: 12 }, () => createDb(file)));
  try {
    const repositories = connections.map((connection) => createAgentQuotaRepository(connection.db));
    const results = await Promise.all([...repositories, ...repositories].map((quota) => quota.reserve("decompose")));
    const reserved = results.flatMap((result) => result.reserved ? [result.used] : []);
    expect(AGENT_RUN_QUOTA).toBe(10);
    expect(reserved.sort((a, b) => a - b)).toEqual(Array.from({ length: 10 }, (_, index) => index + 1));
    expect(results.filter((result) => !result.reserved)).toHaveLength(14);

    const reconnected = await createDb(file);
    connections.push(reconnected);
    const other = createAgentQuotaRepository(reconnected.db);
    expect(await other.reserve("status-update")).toEqual({ reserved: true, used: 1 });
    expect(await other.getUsage("decompose")).toBe(10);
    expect(await other.getUsage("prioritize")).toBe(0);
  } finally {
    connections.forEach((connection) => connection.close());
  }
});

test("DEV-017 AC-4: the counter survives reconnects, repeated migrations and the local seed (no automatic reset)", async () => {
  const first = await createDb(file);
  const repository = createAgentQuotaRepository(first.db);
  for (let index = 0; index < AGENT_RUN_QUOTA; index += 1) expect((await repository.reserve("stuck-radar")).reserved).toBe(true);
  first.close();

  const reopened = await createDb(file);
  try {
    await migrateDatabase(reopened.db);
    await seedDatabase(reopened.db, new Date("2026-11-21T12:00:00Z"));
    const quota = createAgentQuotaRepository(reopened.db);
    expect(await quota.getUsage("stuck-radar")).toBe(AGENT_RUN_QUOTA);
    expect(await quota.reserve("stuck-radar")).toEqual({ reserved: false });
    expect(await quota.getUsage("stuck-radar")).toBe(AGENT_RUN_QUOTA);
  } finally {
    reopened.close();
  }
});
