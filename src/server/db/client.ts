import "server-only";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { getServerEnv } from "@/shared/config/env";

export const createDb = (url: string) => {
  const location = url.startsWith("file:") ? url.slice("file:".length) : url;
  const memory = location === ":memory:";
  const filename = memory ? location : resolve(location);
  if (!memory) mkdirSync(dirname(filename), { recursive: true });

  const sqlite = new Database(filename);
  try {
    sqlite.pragma("foreign_keys = ON");
    if (!memory) sqlite.pragma("journal_mode = WAL");
    sqlite.function("unicode_lower", { deterministic: true }, (value: string) => value.toLowerCase());
    const db = drizzle(sqlite);
    migrate(db, { migrationsFolder: join(process.cwd(), "src/server/db/migrations") });

    const connection = {
      db,
      sqlite,
      close: () => {
        sqlite.close();
        if (globalThis.__devlogDb === connection) globalThis.__devlogDb = undefined;
      },
    };
    return connection;
  } catch (error) {
    sqlite.close();
    throw error;
  }
};

export type DevLogDb = ReturnType<typeof createDb>["db"];

declare global {
  var __devlogDb: ReturnType<typeof createDb> | undefined;
}

export const getDb = () => {
  globalThis.__devlogDb ??= createDb(getServerEnv().DATABASE_URL);
  return globalThis.__devlogDb;
};
