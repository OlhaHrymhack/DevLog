import "server-only";
import type { Logger } from "pino";
import { z } from "zod";
import { AppError, NotFoundError } from "@/shared/api/errors";
import { getServerEnv, type ServerEnv } from "@/shared/config/env";
import { createAgentRunRepository } from "../../agentRuns/repository";
import { createDb, getDb, type DevLogDb } from "../../db/client";
import { readJson, withHandler } from "../../http/handler";
import { logger as appLogger } from "../../logger";
import { createOpenAIClient } from "../core/openAIClient";
import { createAgentContext } from "../core/readTools";
import { runAgent } from "../core/runAgent";
import { createNdjsonResponse } from "../core/stream";
import type { ModelClient } from "../core/types";
import { smokeAgent } from "./smokeAgent";
import { ensureSmokeToken, isValidSmokeToken, SMOKE_TOKEN_HEADER } from "./smokeToken";

/** Жорсткі стелі smoke-запиту: конфігуровані ліміти можуть лише зменшити їх. */
export const SMOKE_MAX_STEPS = 4;
export const SMOKE_MAX_OUTPUT_TOKENS = 400;

const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];
const SAFE_FETCH_SITES = ["same-origin", "none"];

export type SmokeEnv = Pick<ServerEnv, "aiMode" | "OPENAI_API_KEY" | "OPENAI_MODEL" | "AGENT_MAX_STEPS" | "OPENAI_MAX_OUTPUT_TOKENS" | "AI_SMOKE">;

export type SmokeLimits = { maxSteps: number; maxOutputTokens: number };

export type SmokeRouteDeps = {
  getDb?: () => DevLogDb;
  getEnv?: () => SmokeEnv;
  /** Тести підставляють клієнт без мережі; за замовчуванням — `OpenAIClient` із лімітами smoke. */
  createClient?: (env: SmokeEnv, limits: SmokeLimits) => ModelClient;
  nodeEnv?: () => string | undefined;
  /** Очікуваний локальний секрет; за замовчуванням — файл у `data/` (його ж читає CLI). */
  getToken?: () => string;
  logger?: Logger;
};

const notLive = () => new AppError("AI_NOT_LIVE", 409, "Smoke потребує live-режиму з ключем OpenAI");
const forbidden = () => new AppError("FORBIDDEN", 403, "Smoke дозволений лише локально");

const defaultClient = (env: SmokeEnv, limits: SmokeLimits): ModelClient => {
  if (!env.OPENAI_API_KEY) throw notLive();
  return createOpenAIClient({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL, maxOutputTokens: limits.maxOutputTokens });
};

const hostnameOf = (value: string, base = "http://"): string | null => {
  try {
    return new URL(`${base}${value}`).hostname;
  } catch {
    return null;
  }
};

const isLocalHostname = (hostname: string | null): boolean => hostname !== null && LOCAL_HOSTNAMES.includes(hostname);

/**
 * Усі перевірки виконуються до читання тіла й до будь-якого виклику моделі.
 * У Next `request.url` будується з налаштованого hostname сервера, а не із заголовка Host, тому
 * перевіряємо заголовки `Host` і `Origin` (DNS rebinding), а локальний токен закриває доступ із LAN.
 */
const assertSmokeAllowed = (request: Request, env: SmokeEnv, nodeEnv: string | undefined, expectedToken: () => string) => {
  if (nodeEnv === "production" || env.AI_SMOKE !== "1") throw new NotFoundError("Не знайдено");

  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!isLocalHostname(hostnameOf(request.headers.get("host") ?? new URL(request.url).host))) throw forbidden();
  if (origin !== null && !isLocalHostname(hostnameOf(origin, ""))) throw forbidden();
  if (fetchSite !== null && !SAFE_FETCH_SITES.includes(fetchSite)) throw forbidden();
  if (!isValidSmokeToken(request.headers.get(SMOKE_TOKEN_HEADER), expectedToken())) throw forbidden();

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new AppError("UNSUPPORTED_MEDIA_TYPE", 415, "Потрібен Content-Type: application/json");
  }
  if (env.aiMode !== "live") throw notLive();
};

/**
 * Dev-only POST-обробник платного smoke-запиту до OpenAI: один агент, не більше 4 викликів і 400 токенів output.
 * Трасу пишемо в тимчасову in-memory БД, tools читають реальну БД. Файл маршруту має оголосити
 * `runtime = "nodejs"` і `dynamic = "force-dynamic"`.
 */
export const createSmokeRoute = (deps: SmokeRouteDeps = {}) => {
  let busy = false;
  return withHandler(async (request) => {
    const env = deps.getEnv?.() ?? getServerEnv();
    assertSmokeAllowed(request, env, deps.nodeEnv ? deps.nodeEnv() : process.env.NODE_ENV, deps.getToken ?? (() => ensureSmokeToken()));
    if (busy) throw new AppError("SMOKE_BUSY", 409, "Попередній smoke-запит ще виконується");
    busy = true;

    let traceDb: ReturnType<typeof createDb> | undefined;
    try {
      z.strictObject({}).parse(await readJson(request));
      const limits: SmokeLimits = {
        maxSteps: Math.min(env.AGENT_MAX_STEPS, SMOKE_MAX_STEPS),
        maxOutputTokens: Math.min(env.OPENAI_MAX_OUTPUT_TOKENS, SMOKE_MAX_OUTPUT_TOKENS),
      };
      const client = (deps.createClient ?? defaultClient)(env, limits);
      const context = createAgentContext(deps.getDb?.() ?? getDb().db);
      (deps.logger ?? appLogger).info({ ...limits }, "AI smoke started");
      const trace = createDb(":memory:");
      traceDb = trace;

      return createNdjsonResponse((emit, signal) => runAgent(smokeAgent, {}, {
        client, mode: "live", signal, onEvent: emit, context,
        runs: createAgentRunRepository(trace.db), maxSteps: limits.maxSteps, logger: deps.logger,
      }).finally(() => {
        busy = false;
        trace.close();
      }), request.signal);
    } catch (error) {
      busy = false;
      traceDb?.close();
      throw error;
    }
  });
};
