import "server-only";
import { eq, isNull } from "drizzle-orm";
import type { DbExecutor } from "../db/client";
import { tasks } from "./schema";

/** Нормалізований текст пошуку; той самий регістр отримує і запит `q`. */
export const toSearchText = (title: string, description: string) => `${title} ${description}`.toLowerCase();

const BACKFILL_BATCH = 200;

/** Заповнює `search_text` записів зі старих БД (до міграції 0001). Ідемпотентно; кожна пачка — одна транзакція. */
export const backfillSearchText = async (db: DbExecutor): Promise<number> => {
  let updated = 0;
  while (true) {
    const count = await db.transaction(async (tx) => {
      const rows = await tx.select({ id: tasks.id, title: tasks.title, description: tasks.description })
        .from(tasks).where(isNull(tasks.searchText)).limit(BACKFILL_BATCH).all();
      for (const row of rows) {
        await tx.update(tasks).set({ searchText: toSearchText(row.title, row.description) }).where(eq(tasks.id, row.id)).run();
      }
      return rows.length;
    });
    updated += count;
    if (count < BACKFILL_BATCH) return updated;
  }
};
