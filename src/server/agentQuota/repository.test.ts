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

test("DEV-018 AC-2: concurrent reservations share a cap of 50 per feature, 150 total", async () => {
  const connections = await Promise.all(Array.from({ length: 12 }, () => createDb(file)));
  try {
    const repositories = connections.map((connection) => createAgentQuotaRepository(connection.db));
    const [reader] = repositories;
    if (!reader) throw new Error("Test database unavailable");
    expect(AGENT_RUN_QUOTA).toBe(50);
    for (const kind of ["prioritize", "stuck-radar", "voice-draft"] as const) {
      expect(await reader.getUsage(kind)).toBe(0);
      const results = await Promise.all(repositories.flatMap((quota) =>
        Array.from({ length: 5 }, () => quota.reserve(kind))));
      const reserved = results.flatMap((result) => result.reserved ? [result.used] : []);
      expect(reserved.sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, index) => index + 1));
      expect(results.filter((result) => !result.reserved)).toHaveLength(10);
    }
    const counters = await reader.listUsage();
    expect(counters.reduce((total, row) => total + row.used, 0)).toBe(150);
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
