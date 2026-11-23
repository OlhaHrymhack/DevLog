import "server-only";
import { AppError } from "@/shared/api/errors";
import { getDb, type DbExecutor } from "../db/client";
import { logger } from "../logger";
import { createAgentQuotaRepository } from "./repository";
import type { AgentQuotaKind } from "./schema";

const defaultDb = async () => (await getDb()).db;

/** Скільки запит чекає на сховище квоти (відкриття БД, перевірка входу, резервування), перш ніж віддати 503. */
export const QUOTA_STORAGE_TIMEOUT_MS = 5_000;

const exhausted = () => new AppError(
  "AGENT_QUOTA_EXHAUSTED", 429, "Ліміт запусків цього агента для демо вичерпано (10 на всіх відвідувачів)",
);
const unavailable = () => new AppError(
  "AGENT_QUOTA_UNAVAILABLE", 503, "Не вдалося перевірити ліміт запусків агента. Спробуйте пізніше",
);

class QuotaTimeoutError extends Error {
  constructor() {
    super("Agent quota storage timed out");
    this.name = "QuotaTimeoutError";
  }
}

/** Обмежує очікування; таймер знімається в `finally`. Сама операція не скасовується. */
const withDeadline = async <T>(work: (assertActive: () => void) => Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expired = false;
  const assertActive = () => {
    if (expired) throw new QuotaTimeoutError();
  };
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      expired = true;
      reject(new QuotaTimeoutError());
    }, ms);
  });
  try {
    return await Promise.race([work(assertActive), deadline]);
  } finally {
    clearTimeout(timer);
  }
};

export type ReserveOptions = {
  /**
   * Перевірка входу через БД до резервування (напр. що `taskId` існує). Кидає `AppError` (404) — запит відхиляється
   * без витрати спроби; будь-яка інша помилка — сховище недоступне (503).
   */
  check?: (db: DbExecutor) => Promise<void>;
  timeoutMs?: number;
};

/**
 * Fail closed: будь-який збій чи таймаут відкриття БД, перевірки або резервування → 503, модель не викликається.
 * Якщо запис резервування міг виконатися (таймаут після відправки), спроба не повертається.
 */
export const reserveAgentQuota = async (
  kind: AgentQuotaKind,
  openDb: () => DbExecutor | Promise<DbExecutor> = defaultDb,
  log = logger,
  { check, timeoutMs = QUOTA_STORAGE_TIMEOUT_MS }: ReserveOptions = {},
): Promise<DbExecutor> => {
  let outcome: { db: DbExecutor; reserved: boolean };
  try {
    outcome = await withDeadline(async (assertActive) => {
      const db = await openDb();
      assertActive();
      await check?.(db);
      assertActive();
      const { reserved } = await createAgentQuotaRepository(db).reserve(kind);
      return { db, reserved };
    }, timeoutMs);
  } catch (error) {
    if (error instanceof AppError) throw error;
    log.error({ kind, errorName: error instanceof Error ? error.name : "unknown" }, "Agent quota storage unavailable");
    throw unavailable();
  }
  if (!outcome.reserved) throw exhausted();
  return outcome.db;
};
