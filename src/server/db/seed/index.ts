import "server-only";
import { count } from "drizzle-orm";
import { agentRuns } from "../../agentRuns/schema";
import { tasks } from "../../tasks/schema";
import { insertSeedTasks, seedTasks } from "../../tasks/seed/seed";
import type { DbExecutor } from "../client";

/**
 * Локальний seed: замінює задачі фікстурами й очищає трасу запусків. Одна транзакція.
 * Лічильники квоти (`agent_quotas`) не скидає ніколи.
 */
export const seedDatabase = (db: DbExecutor, now: Date): Promise<number> => db.transaction(async (tx) => {
  await tx.delete(agentRuns).run();
  return seedTasks(tx, now);
});

/**
 * Одноразове засівання віддаленої демобази: вставляє фікстури лише в порожню таблицю задач і нічого не видаляє.
 * Повторний запуск (зокрема після deploy) — no-op, тож задачі відвідувачів і квоти зберігаються.
 */
export const seedIfEmpty = (db: DbExecutor, now: Date): Promise<number> => db.transaction(async (tx) => {
  const existing = (await tx.select({ count: count() }).from(tasks).get())?.count ?? 0;
  if (existing > 0) return 0;
  return insertSeedTasks(tx, now);
});
