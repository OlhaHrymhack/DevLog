import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { oneOf } from "../db/checks";
import { AGENT_RUN_DB_ENUMS } from "../agentRuns/schema";

export const AGENT_QUOTA_KINDS = [...AGENT_RUN_DB_ENUMS.runKind, "voice-draft"] as const;
export type AgentQuotaKind = typeof AGENT_QUOTA_KINDS[number];

/** Спільний лічильник запусків на тип агента (стабільний ключ — `kind`). Без автоматичного скидання. */
export const agentQuotas = sqliteTable("agent_quotas", {
  kind: text({ enum: AGENT_QUOTA_KINDS }).primaryKey(),
  used: integer().notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  check("agent_quotas_kind_check", oneOf(table.kind, AGENT_QUOTA_KINDS)),
  check("agent_quotas_used_check", sql`${table.used} >= 0`),
]);
