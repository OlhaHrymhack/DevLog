import { afterEach, expect, it, vi } from "vitest";
import * as dbClient from "@/server/db/client";
import { createAgentQuotaRepository } from "@/server/agentQuota/repository";
import { logger } from "@/server/logger";
import * as config from "@/shared/config/env";
import { GET } from "./route";

const readQuota = () => GET(new Request("http://localhost/api/agents/quota"));
const baseEnv = config.parseServerEnv({});

afterEach(() => vi.restoreAllMocks());

it("DEV-018 AC-2: reports only the public counters and reading does not reserve a launch", async () => {
  const connection = await dbClient.createDb(":memory:");
  try {
    vi.spyOn(logger, "info").mockImplementation(() => undefined);
    vi.spyOn(dbClient, "getDb").mockResolvedValue(connection);
    vi.spyOn(config, "getServerEnv").mockReturnValue({ ...baseEnv, aiMode: "live", agentQuota: true });
    const quota = createAgentQuotaRepository(connection.db);
    await quota.reserve("prioritize");
    await quota.reserve("decompose");
    await quota.reserve("voice-draft");

    const initial = { enabled: true, limit: 50, used: { prioritize: 1, "stuck-radar": 0, "voice-draft": 1 } };
    const first = await readQuota();
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect(await first.json()).toEqual(initial);
    expect(await (await readQuota()).json()).toEqual(initial);

  } finally {
    connection.close();
  }
});

it("DEV-018 AC-3: with quota disabled the read endpoint does not open the database", async () => {
  vi.spyOn(logger, "info").mockImplementation(() => undefined);
  vi.spyOn(config, "getServerEnv").mockReturnValue(baseEnv);
  const open = vi.spyOn(dbClient, "getDb");
  expect(await (await readQuota()).json()).toEqual({ enabled: false });
  expect(open).not.toHaveBeenCalled();
});
