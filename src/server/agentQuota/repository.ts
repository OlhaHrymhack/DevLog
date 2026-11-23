import "server-only";
import { sql } from "drizzle-orm";
import type { DbExecutor } from "../db/client";
import { agentQuotas, type AgentQuotaKind } from "./schema";

/** Спільна межа запусків кожного агента для всіх відвідувачів (Vercel Production). */
export const AGENT_RUN_QUOTA = 10;

export type QuotaReservation = { reserved: true; used: number } | { reserved: false };

export const createAgentQuotaRepository = (db: DbExecutor) => {
  /**
   * Один умовний атомарний запис: перший запуск створює рядок з `used = 1`, наступні збільшують лічильник,
   * лише поки він менший за межу. Порожній `returning` — межу вичерпано. Інстанси й з'єднання
   * не мають спільного стану, крім цього рядка, тож межу не перевищують і паралельні запити.
   */
  const reserve = async (kind: AgentQuotaKind, limit = AGENT_RUN_QUOTA, now = new Date()): Promise<QuotaReservation> => {
    if (limit < 1) return { reserved: false };
    const updatedAt = now.toISOString();
    const row = await db.insert(agentQuotas).values({ kind, used: 1, updatedAt })
      .onConflictDoUpdate({
        target: agentQuotas.kind,
        set: { used: sql`${agentQuotas.used} + 1`, updatedAt },
        setWhere: sql`${agentQuotas.used} < ${limit}`,
      })
      .returning({ used: agentQuotas.used }).get();
    return row ? { reserved: true, used: row.used } : { reserved: false };
  };

  const getUsage = async (kind: AgentQuotaKind): Promise<number> =>
    (await db.select({ used: agentQuotas.used }).from(agentQuotas).where(sql`${agentQuotas.kind} = ${kind}`).get())?.used ?? 0;

  return { reserve, getUsage };
};
