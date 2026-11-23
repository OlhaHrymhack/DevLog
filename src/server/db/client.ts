import "server-only";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client, type ResultSet } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { getServerEnv, REMOTE_DATABASE_SCHEMES } from "@/shared/config/env";
import { backfillSearchText } from "../tasks/searchText";
import { serializeClient } from "./serializeClient";

export const MIGRATIONS_FOLDER = join(process.cwd(), "src/server/db/migrations");

/** Скільки локальний файл чекає на блокування іншого процесу (CLI seed поруч із сервером). */
const LOCAL_BUSY_TIMEOUT_MS = 5_000;

export type DevLogDb = LibSQLDatabase;
/** Спільний тип для бази й транзакції: репозиторії працюють з обома, вкладена транзакція стає savepoint. */
export type DbExecutor = BaseSQLiteDatabase<"async", ResultSet>;

export type DbLocation =
  | { kind: "memory" }
  | { kind: "file"; path: string }
  | { kind: "remote"; url: string };

export const parseDatabaseUrl = (url: string): DbLocation => {
  if (REMOTE_DATABASE_SCHEMES.some((scheme) => url.startsWith(scheme))) return { kind: "remote", url };
  const location = url.startsWith("file:") ? url.slice("file:".length) : url;
  if (location === ":memory:") return { kind: "memory" };
  return { kind: "file", path: resolve(location) };
};

export const isRemoteDatabaseUrl = (url: string) => parseDatabaseUrl(url).kind === "remote";

export type DbConnection = { db: DevLogDb; client: Client; location: DbLocation; close: () => void };

type OpenOptions = {
  authToken?: string;
  /**
   * Застосувати міграції під час відкриття. За замовчуванням — лише для локальної БД:
   * віддалену мігрує окрема команда `db:migrate`, а не старт serverless-функції.
   */
  migrate?: boolean;
};

const openClient = (location: DbLocation, authToken: string | undefined): Client => {
  switch (location.kind) {
    case "remote":
      return createClient({ url: location.url, authToken });
    case "memory":
      return serializeClient(createClient({ url: ":memory:" }));
    case "file":
      mkdirSync(dirname(location.path), { recursive: true });
      return serializeClient(createClient({ url: pathToFileURL(location.path).href, timeout: LOCAL_BUSY_TIMEOUT_MS }), location.path);
  }
};

/** Міграції схеми і заповнення похідних колонок наявних записів. Ідемпотентно. */
export const migrateDatabase = async (db: DevLogDb) => {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  await backfillSearchText(db);
};

declare global {
  var __devlogMigrations: Map<string, Promise<void>> | undefined;
}

/**
 * Drizzle спершу читає історію міграцій, потім пише — це не атомарно. Тож з'єднання одного процесу до тієї ж БД
 * мігрують по черзі: наступне бачить уже застосовану історію й нічого не повторює.
 */
const migrateInOrder = (key: string, db: DevLogDb): Promise<void> => {
  globalThis.__devlogMigrations ??= new Map();
  const previous = globalThis.__devlogMigrations.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(() => migrateDatabase(db));
  globalThis.__devlogMigrations.set(key, current);
  return current;
};

const migrationKey = (location: DbLocation): string | undefined => {
  switch (location.kind) {
    case "memory":
      return undefined;
    case "file":
      return location.path;
    case "remote":
      return location.url;
  }
};

export const createDb = async (url: string, options: OpenOptions = {}): Promise<DbConnection> => {
  const location = parseDatabaseUrl(url);
  const client = openClient(location, options.authToken);
  try {
    if (location.kind === "file") await client.execute("PRAGMA journal_mode = WAL");
    const db = drizzle({ client });
    if (options.migrate ?? location.kind !== "remote") {
      const key = migrationKey(location);
      await (key === undefined ? migrateDatabase(db) : migrateInOrder(key, db));
    }
    return { db, client, location, close: () => client.close() };
  } catch (error) {
    client.close();
    throw error;
  }
};

declare global {
  var __devlogDb: Promise<DbConnection> | undefined;
}

/** Одне з'єднання на процес. Невдале відкриття не кешується — наступний запит спробує знову. */
export const getDb = (): Promise<DbConnection> => {
  if (!globalThis.__devlogDb) {
    const { DATABASE_URL, DATABASE_AUTH_TOKEN } = getServerEnv();
    const opening: Promise<DbConnection> = createDb(DATABASE_URL, { authToken: DATABASE_AUTH_TOKEN }).then((connection) => ({
      ...connection,
      close: () => {
        connection.close();
        if (globalThis.__devlogDb === opening) globalThis.__devlogDb = undefined;
      },
    }));
    globalThis.__devlogDb = opening;
    opening.catch(() => {
      if (globalThis.__devlogDb === opening) globalThis.__devlogDb = undefined;
    });
  }
  return globalThis.__devlogDb;
};
