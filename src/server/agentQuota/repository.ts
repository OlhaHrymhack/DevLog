import "server-only";
import { sql } from "drizzle-orm";
import type { DbExecutor } from "../db/client";
import { agentQuotas, type AgentQuotaKind } from "./schema";

/** Спільна межа запусків усіх AI-функцій для всіх відвідувачів. */
export const AGENT_RUN_QUOTA = 150;

export type QuotaReservation = { reserved: true; used: number } | { reserved: false };

export const createAgentQuotaRepository = (db: DbExecutor) => {
  // SQLite перевіряє суму й оновлює лічильник одним записом, зокрема для нових типів запусків.
  const reserve = async (kind: AgentQuotaKind, limit = AGENT_RUN_QUOTA, now = new Date()): Promise<QuotaReservation> => {
    const updatedAt = now.toISOString();
    const row = await db.insert(agentQuotas).select(sql`
      SELECT ${kind}, 1, ${updatedAt}
      WHERE (SELECT coalesce(sum(${agentQuotas.used}), 0) FROM ${agentQuotas}) < ${limit}
    `)
      .onConflictDoUpdate({
        target: agentQuotas.kind,
        set: { used: sql`${agentQuotas.used} + 1`, updatedAt },
      })
      .returning({ used: agentQuotas.used }).get();
    return row ? { reserved: true, used: row.used } : { reserved: false };
  };

  const getUsage = async (kind: AgentQuotaKind): Promise<number> =>
    (await db.select({ used: agentQuotas.used }).from(agentQuotas).where(sql`${agentQuotas.kind} = ${kind}`).get())?.used ?? 0;

  const listUsage = () => db.select({ kind: agentQuotas.kind, used: agentQuotas.used }).from(agentQuotas).all();

  return { reserve, getUsage, listUsage };
};
