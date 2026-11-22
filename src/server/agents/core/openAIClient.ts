import "server-only";
import OpenAI from "openai";
import type {
  ChatCompletion, ChatCompletionCreateParamsNonStreaming, ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import type { ModelClient, ModelMessage, ModelRequest, ModelResponse, ModelStop, ToolCall } from "./types";

/** Верхня межа output на один виклик моделі; 8 викликів → ≤ 16 384 токенів на запуск. */
export const MAX_COMPLETION_TOKENS = 2048;

/** Таймаут одного виклику моделі (дефолт SDK — 10 хв); загальний дедлайн запуску задає `runAgent`. */
export const MODEL_TIMEOUT_MS = 60_000;

/** Мінімальний зріз SDK, потрібний адаптеру; у тестах підставляється без мережі. */
export type ChatCompletionsApi = {
  create: (
    body: ChatCompletionCreateParamsNonStreaming,
    options: { signal: AbortSignal; maxRetries: number; timeout: number },
  ) => PromiseLike<ChatCompletion>;
};

type OpenAIClientOptions = {
  apiKey: string;
  model: string;
  /** Ліміт output-токенів на виклик; за замовчуванням `MAX_COMPLETION_TOKENS`. */
  maxOutputTokens?: number;
  completions?: ChatCompletionsApi;
};

const toOpenAIMessage = (message: ModelMessage): ChatCompletionMessageParam => {
  if (message.role === "user") return { role: "user", content: message.content };
  if (message.role === "tool") return { role: "tool", tool_call_id: message.toolCallId, content: message.content };
  if (message.toolCalls.length === 0) return { role: "assistant", content: message.content };
  return {
    role: "assistant",
    content: message.content || null,
    tool_calls: message.toolCalls.map(({ id, name, arguments: args }) => ({
      id, type: "function", function: { name, arguments: args },
    })),
  };
};

export const toOpenAIRequest = (
  model: string,
  { system, messages, tools }: ModelRequest,
  maxOutputTokens: number = MAX_COMPLETION_TOKENS,
): ChatCompletionCreateParamsNonStreaming => ({
  model,
  messages: [{ role: "system", content: system }, ...messages.map(toOpenAIMessage)],
  tools: tools.map(({ name, description, parameters }) => ({
    type: "function",
    function: { name, description, parameters, strict: true },
  })),
  tool_choice: "auto",
  max_completion_tokens: maxOutputTokens,
});

/** `finish_reason` → внутрішня зупинка: tool_calls → tool_use, stop → end, length → max_tokens, content_filter / refusal → refusal. */
export const fromOpenAICompletion = (completion: ChatCompletion): ModelResponse => {
  const choice = completion.choices[0];
  if (!choice) throw new Error("OpenAI response has no choices");
  const { message, finish_reason: finishReason } = choice;
  const text = message.content ?? "";
  if (message.refusal || finishReason === "content_filter") return { stop: "refusal", toolCalls: [], text: message.refusal ?? text };
  if (finishReason === "length") return { stop: "max_tokens", toolCalls: [], text };

  const toolCalls: ToolCall[] = (message.tool_calls ?? []).map((call) => call.type === "function"
    ? { id: call.id, name: call.function.name, arguments: call.function.arguments }
    : { id: call.id, name: call.custom.name, arguments: call.custom.input });
  const stop: ModelStop = toolCalls.length > 0 ? "tool_use" : "end";
  return { stop, toolCalls, text };
};

/** Live-адаптер Chat Completions. Неявні повтори SDK вимкнено: циклом і бюджетом керує `runAgent`. */
export const createOpenAIClient = ({ apiKey, model, completions, maxOutputTokens }: OpenAIClientOptions): ModelClient => {
  const api: ChatCompletionsApi = completions ?? new OpenAI({ apiKey, maxRetries: 0, timeout: MODEL_TIMEOUT_MS }).chat.completions;
  return {
    provider: "openai",
    create: async (request) => {
      const completion = await api.create(toOpenAIRequest(model, request, maxOutputTokens), { signal: request.signal, maxRetries: 0, timeout: MODEL_TIMEOUT_MS });
      return fromOpenAICompletion(completion);
    },
  };
};
