import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { PublicQuotaKindSchema } from "@/shared/api/agentQuota/schema";
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

test("DEV-019 AC-1: concurrent mixed reservations share a single cap of 150", async () => {
  const connections = await Promise.all(Array.from({ length: 12 }, () => createDb(file)));
  try {
    const repositories = connections.map((connection) => createAgentQuotaRepository(connection.db));
    const [reader] = repositories;
    if (!reader) throw new Error("Test database unavailable");
    const kinds = PublicQuotaKindSchema.options;
    const results = await Promise.all(repositories.flatMap((quota) =>
      kinds.flatMap((kind) => Array.from({ length: 3 }, () => quota.reserve(kind)))));
    expect(results.filter((result) => result.reserved)).toHaveLength(150);
    const counters = await reader.listUsage();
    expect(counters.reduce((total, row) => total + row.used, 0)).toBe(150);
    for (const kind of kinds) expect(await reader.reserve(kind)).toEqual({ reserved: false });
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
