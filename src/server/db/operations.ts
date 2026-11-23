import "server-only";
import { createDb, isRemoteDatabaseUrl } from "./client";
import { seedDatabase, seedIfEmpty } from "./seed";

export const DB_COMMANDS = ["migrate", "seed", "seed-remote"] as const;
export type DbCommand = (typeof DB_COMMANDS)[number];

export const isDbCommand = (value: string | undefined): value is DbCommand =>
  DB_COMMANDS.some((command) => command === value);

export type DbTarget = { url: string; authToken?: string };

export class DbCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DbCommandError";
  }
}

export type DbCommandResult =
  | { command: "migrate"; remote: boolean }
  | { command: "seed" | "seed-remote"; remote: boolean; tasks: number };

/**
 * Операції з БД поза стартом застосунку:
 * - `migrate` — міграції й заповнення похідних колонок (локальна чи віддалена БД; окремо від serverless-функцій);
 * - `seed` — лише локальний файл: замінює задачі фікстурами; віддалену (production) базу не чіпає;
 * - `seed-remote` — одноразово засіває порожню віддалену демобазу, нічого не видаляє; повтор — no-op.
 */
export const runDbCommand = async (command: DbCommand, target: DbTarget, now = new Date()): Promise<DbCommandResult> => {
  const remote = isRemoteDatabaseUrl(target.url);
  if (command === "seed" && remote) {
    throw new DbCommandError("db:seed замінює всі задачі й працює лише з локальним SQLite-файлом. Для порожньої віддаленої демобази: db:seed:remote.");
  }
  if (command === "seed-remote" && !remote) {
    throw new DbCommandError("db:seed:remote призначений для віддаленої libSQL-бази. Для локального файла: db:seed.");
  }

  const connection = await createDb(target.url, { authToken: target.authToken, migrate: command === "migrate" || !remote });
  try {
    switch (command) {
      case "migrate":
        return { command, remote };
      case "seed":
        return { command, remote, tasks: await seedDatabase(connection.db, now) };
      case "seed-remote":
        return { command, remote, tasks: await seedIfEmpty(connection.db, now) };
    }
  } finally {
    connection.close();
  }
};
