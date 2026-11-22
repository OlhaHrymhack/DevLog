import "server-only";
import type { Logger } from "pino";
import type { z } from "zod";
import { createAgentRequestSchema, MAX_AGENT_STEPS } from "@/entities/agentRun";
import { getServerEnv, type ServerEnv } from "@/shared/config/env";
import { createAgentRunRepository } from "../../agentRuns/repository";
import { getDb, type DevLogDb } from "../../db/client";
import { readJson, withHandler } from "../../http/handler";
import { selectModelClient } from "./modelClient";
import { createAgentContext } from "./readTools";
import { runAgent } from "./runAgent";
import { createNdjsonResponse } from "./stream";
import type { AgentDefinition, ModelClient, ScriptedTurn } from "./types";

type AgentEnv = Pick<ServerEnv, "aiMode" | "OPENAI_API_KEY" | "OPENAI_MODEL"> & Partial<Pick<ServerEnv, "AGENT_MAX_STEPS" | "OPENAI_MAX_OUTPUT_TOKENS">>;

export type AgentRouteDeps = {
  getDb?: () => DevLogDb;
  getEnv?: () => AgentEnv;
  createClient?: (env: AgentEnv, script: () => readonly ScriptedTurn[]) => ModelClient;
  now?: () => Date;
  maxSteps?: number;
  logger?: Logger;
};

/**
 * Спільний POST-обробник агента → NDJSON-стрім. Тіло перевіряється строгою схемою до відкриття стріму (400).
 * Файл маршруту агента (DEV-009…012) має також оголосити `runtime = "nodejs"` і `dynamic = "force-dynamic"`,
 * щоб Next.js не буферизував відповідь.
 */
export const createAgentRoute = <Input extends z.ZodType, Result extends z.ZodType>(
  def: AgentDefinition<Input, Result>,
  deps: AgentRouteDeps = {},
) => withHandler(async (request) => {
  const allowDebug = process.env.NODE_ENV !== "production";
  const body = createAgentRequestSchema({ allowDebug }).parse(await readJson(request));
  const input = def.inputSchema.parse(body.input);
  const db = deps.getDb?.() ?? getDb().db;
  const env = deps.getEnv?.() ?? getServerEnv();
  const context = createAgentContext(db, deps.now?.() ?? new Date());
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
