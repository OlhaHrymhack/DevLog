import "server-only";
import { PublicQuotaKindSchema, type AgentQuota } from "@/shared/api/agentQuota/schema";
import { getDb } from "../db/client";
import { AGENT_RUN_QUOTA, createAgentQuotaRepository } from "./repository";

export const getAgentQuotaSummary = async (enabled: boolean): Promise<AgentQuota> => {
  if (!enabled) return { enabled: false };

  const { db } = await getDb();
  const used = { prioritize: 0, "stuck-radar": 0, "voice-draft": 0, decompose: 0, "status-update": 0 };
  for (const row of await createAgentQuotaRepository(db).listUsage()) {
    const kind = PublicQuotaKindSchema.safeParse(row.kind);
    if (kind.success) used[kind.data] = row.used;
  }
  return { enabled: true, limit: AGENT_RUN_QUOTA, used };
};
