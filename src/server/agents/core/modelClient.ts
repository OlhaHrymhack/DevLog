import "server-only";
import type { ServerEnv } from "@/shared/config/env";
import { sleep } from "./abort";
import { createOpenAIClient } from "./openAIClient";
import { SUBMIT_RESULT_TOOL } from "./tools";
import type { ModelClient, ModelMessage, ModelResponse, ScriptedTurn, ToolCall } from "./types";

let scriptedCallId = 0;

/** Хелпери для сценаріїв demo і тестів. */
export const scriptedToolCall = (name: string, args: unknown): ToolCall => ({
  id: `call_${++scriptedCallId}`,
  name,
  arguments: JSON.stringify(args),
});

export const scriptedTurn = (...toolCalls: ToolCall[]): ScriptedTurn => ({ stop: "tool_use", toolCalls, text: "" });

export const scriptedSubmit = (result: unknown): ScriptedTurn => scriptedTurn(scriptedToolCall(SUBMIT_RESULT_TOOL, result));

const END_TURN: ModelResponse = { stop: "end", toolCalls: [], text: "" };

type ScriptedClientOptions = {
  /** Пауза перед кожною відповіддю (у demo — щоб прогрес був видимий). Поважає `signal`. */
  delayMs?: number;
};

/** Детермінований клієнт: віддає ходи сценарію по черзі; коли сценарій вичерпано — `end` без tool-викликів. */
export const createScriptedClient = (script: readonly ScriptedTurn[], { delayMs = 0 }: ScriptedClientOptions = {}): ModelClient => {
  let cursor = 0;
  return {
    provider: "scripted",
    create: async ({ signal }) => {
      if (delayMs > 0) await sleep(delayMs, signal);
      signal.throwIfAborted();
      const turn = script[cursor];
      cursor += 1;
      return turn ?? END_TURN;
    },
  };
};

const isSubmitRejection = (messages: readonly ModelMessage[]): boolean => {
  const last = messages.at(-1);
  if (last?.role !== "tool" || !last.isError) return false;
  const call = messages.flatMap((message) => message.role === "assistant" ? message.toolCalls : [])
    .find((toolCall) => toolCall.id === last.toolCallId);
  return call?.name === SUBMIT_RESULT_TOOL;
};

/**
 * Fault injection (лише dev): кожен `submit_result` підміняється «хибним кейсом» агента,
 * а на повтор після відхилення модель знову «віддає» хибний результат → два відхилення → fallback.
 */
export const withForcedInvalidOutput = (client: ModelClient, invalidResult: unknown): ModelClient => ({
  provider: client.provider,
  create: async (request) => {
    const invalidArguments = JSON.stringify(invalidResult);
    if (isSubmitRejection(request.messages)) {
      return { ...scriptedSubmit(invalidResult), injected: true };
    }
    const response = await client.create(request);
    const replaced = response.toolCalls.some((call) => call.name === SUBMIT_RESULT_TOOL);
    return {
      ...response,
      ...(replaced ? { injected: true } : {}),
      toolCalls: response.toolCalls.map((call) => call.name === SUBMIT_RESULT_TOOL ? { ...call, arguments: invalidArguments } : call),
    };
  },
});

export const DEMO_STEP_DELAY_MS = 450;

/** Вибір адаптера за `aiMode`: demo → `ScriptedClient`, live → `OpenAIClient` (ключ лише з серверного env). */
export const selectModelClient = (
  env: Pick<ServerEnv, "aiMode" | "OPENAI_API_KEY" | "OPENAI_MODEL">,
  script: () => readonly ScriptedTurn[],
  options: ScriptedClientOptions = { delayMs: DEMO_STEP_DELAY_MS },
): ModelClient => {
  if (env.aiMode === "live" && env.OPENAI_API_KEY) {
    return createOpenAIClient({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL });
  }
  return createScriptedClient(script(), options);
};
