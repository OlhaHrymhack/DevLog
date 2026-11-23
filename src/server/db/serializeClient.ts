import "server-only";
import type { Client, InArgs, InStatement, Transaction, TransactionMode } from "@libsql/client";

type Release = () => void;
type Lock = () => Promise<Release>;

/** Черга без пріоритетів: кожен наступний чекає на звільнення попереднього. Ніколи не reject-иться. */
const createLock = (): Lock => {
  let tail: Promise<void> = Promise.resolve();
  return () => {
    const previous = tail;
    let release: Release = () => undefined;
    tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    return previous.then(() => release);
  };
};

declare global {
  var __devlogDbLocks: Map<string, Lock> | undefined;
}

const lockFor = (key: string | undefined): Lock => {
  if (key === undefined) return createLock();
  globalThis.__devlogDbLocks ??= new Map();
  const existing = globalThis.__devlogDbLocks.get(key);
  if (existing) return existing;
  const lock = createLock();
  globalThis.__devlogDbLocks.set(key, lock);
  return lock;
};

const once = (release: Release): Release => {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    release();
  };
};

const guarded = async <T>(lock: Lock, run: () => Promise<T>): Promise<T> => {
  const release = await lock();
  try {
    return await run();
  } finally {
    release();
  }
};

const wrapTransaction = (tx: Transaction, release: Release): Transaction => ({
  execute: (stmt) => tx.execute(stmt),
  batch: (stmts) => tx.batch(stmts),
  executeMultiple: (sql) => tx.executeMultiple(sql),
  rollback: async () => {
    try {
      await tx.rollback();
    } finally {
      release();
    }
  },
  commit: async () => {
    try {
      await tx.commit();
    } finally {
      release();
    }
  },
  close: () => {
    tx.close();
    release();
  },
  get closed() {
    return tx.closed;
  },
});

/**
 * Локальна SQLite (файл або `:memory:`) має busy_timeout і не чекає на транзакцію з того ж процесу:
 * запис під час відкритої транзакції одразу отримує SQLITE_BUSY, а `:memory:` має одне з'єднання.
 * Тому операції одного процесу над одним файлом виконуються по черзі; транзакція тримає чергу до commit/rollback.
 * Наслідок: запит до `db` (не `tx`) всередині транзакції зависне — усі операції транзакції мають іти через `tx`.
 * Віддалений libSQL (Turso) цю обгортку не використовує: конкурентністю керує сервер.
 */
export const serializeClient = (client: Client, key?: string): Client => {
  const lock = lockFor(key);
  return {
    execute: (stmtOrSql: InStatement | string, args?: InArgs) =>
      guarded(lock, () => typeof stmtOrSql === "string" ? client.execute(stmtOrSql, args) : client.execute(stmtOrSql)),
    batch: (stmts, mode?: TransactionMode) => guarded(lock, () => client.batch(stmts, mode)),
    migrate: (stmts) => guarded(lock, () => client.migrate(stmts)),
    executeMultiple: (sql) => guarded(lock, () => client.executeMultiple(sql)),
    sync: () => client.sync(),
    transaction: async (mode?: TransactionMode) => {
      const release = once(await lock());
      try {
        return wrapTransaction(await client.transaction(mode), release);
      } catch (error) {
        release();
        throw error;
      }
    },
    close: () => client.close(),
    reconnect: () => client.reconnect(),
    get closed() {
      return client.closed;
    },
    get protocol() {
      return client.protocol;
    },
  };
};
