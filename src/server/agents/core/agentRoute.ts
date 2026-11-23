import "server-only";
import type { Logger } from "pino";
import type { z } from "zod";
import { createAgentRequestSchema, MAX_AGENT_STEPS } from "@/entities/agentRun";
import { NotFoundError } from "@/shared/api/errors";
import { getServerEnv, type ServerEnv } from "@/shared/config/env";
import { reserveAgentQuota } from "../../agentQuota/reserve";
import { createAgentRunRepository } from "../../agentRuns/repository";
import { getDb, type DbExecutor } from "../../db/client";
import { readJson, withHandler } from "../../http/handler";
import { createTaskRepository } from "../../tasks/repository";
import { selectModelClient } from "./modelClient";
import { createAgentContext } from "./readTools";
import { runAgent } from "./runAgent";
import { createNdjsonResponse } from "./stream";
import type { AgentDefinition, ModelClient, ScriptedTurn } from "./types";

type AgentEnv = Pick<ServerEnv, "aiMode" | "OPENAI_API_KEY" | "OPENAI_MODEL">
  & Partial<Pick<ServerEnv, "AGENT_MAX_STEPS" | "OPENAI_MAX_OUTPUT_TOKENS" | "agentQuota">>;

export type AgentRouteDeps = {
  getDb?: () => DbExecutor | Promise<DbExecutor>;
  getEnv?: () => AgentEnv;
  createClient?: (env: AgentEnv, script: () => readonly ScriptedTurn[]) => ModelClient;
  now?: () => Date;
  maxSteps?: number;
  logger?: Logger;
  /** Межа очікування сховища квоти; за замовчуванням `QUOTA_STORAGE_TIMEOUT_MS`. */
  quotaTimeoutMs?: number;
};

/**
 * Спільний POST-обробник агента → NDJSON-стрім. Тіло перевіряється строгою схемою до відкриття стріму (400).
 * Якщо квота ввімкнена (`agentQuota`), після валідації й до створення клієнта моделі сервер атомарно резервує спробу:
 * вичерпано → 429, сховище недоступне або не відповіло вчасно → 503; неіснуючий `def.taskId` → 404 до резервування.
 * Модель у цих випадках не викликається. Спроба не повертається
 * ні при скасуванні, ні при помилці після резервування.
 * Файл маршруту агента має також оголосити `runtime = "nodejs"` і `dynamic = "force-dynamic"`,
 * щоб Next.js не буферизував відповідь.
 */
export const createAgentRoute = <Input extends z.ZodType, Result extends z.ZodType>(
  def: AgentDefinition<Input, Result>,
  deps: AgentRouteDeps = {},
) => withHandler(async (request) => {
  const allowDebug = process.env.NODE_ENV !== "production";
  const body = createAgentRequestSchema({ allowDebug }).parse(await readJson(request));
  const input = def.inputSchema.parse(body.input);
  const env = deps.getEnv?.() ?? getServerEnv();
  const openDb = deps.getDb ?? (async () => (await getDb()).db);
  const taskId = def.taskId?.(input) ?? null;
  const db = env.agentQuota
    ? await reserveAgentQuota(def.kind, openDb, deps.logger, {
      check: async (connection) => {
        if (taskId !== null && !await createTaskRepository(connection).getTaskRow(taskId)) throw new NotFoundError("Задачу не знайдено");
      },
      timeoutMs: deps.quotaTimeoutMs,
    })
    : await openDb();
  const context = await createAgentContext(db, deps.now?.() ?? new Date());
  const client = (deps.createClient ?? selectModelClient)(env, () => def.mockScript(input, context));

  return createNdjsonResponse((emit, signal) => runAgent(def, input, {
    client,
    mode: client.provider === "openai" ? "live" : "demo",
    signal,
    onEvent: emit,
    context,
    runs: createAgentRunRepository(db),
    maxSteps: Math.min(deps.maxSteps ?? env.AGENT_MAX_STEPS ?? MAX_AGENT_STEPS, MAX_AGENT_STEPS),
    forceInvalidOutput: body.debug?.forceInvalidOutput ?? false,
    logger: deps.logger,
  }), request.signal);
});
