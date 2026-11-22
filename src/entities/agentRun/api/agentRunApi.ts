import { ApiErrorResponseSchema } from "@/shared/api/errors";
import { ApiError } from "@/shared/api/http";
import { readNdjson } from "@/shared/lib/readNdjson";
import { AgentEventSchema } from "../model/events";
import type { AgentEvent, AgentRunKind } from "../model/types";

export const agentRunPath = (kind: AgentRunKind) => `/api/agents/${kind}`;

type StreamAgentRunOptions = {
  kind: AgentRunKind;
  input: unknown;
  forceInvalidOutput: boolean;
  signal: AbortSignal;
  onEvent: (event: AgentEvent) => void;
};

const INVALID_STREAM = () => new ApiError("INVALID_RESPONSE", "Сервер повернув неочікувану відповідь агента");

/** POST запуску агента і читання NDJSON-подій. `debug` додається лише коли dev-прапорець увімкнено. */
export const streamAgentRun = async ({ kind, input, forceInvalidOutput, signal, onEvent }: StreamAgentRunOptions): Promise<void> => {
  let response: Response;
  try {
    response = await fetch(agentRunPath(kind), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
      body: JSON.stringify({ input, ...(forceInvalidOutput ? { debug: { forceInvalidOutput: true } } : {}) }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ApiError("NETWORK_ERROR", "Не вдалося з’єднатися із сервером");
  }

  if (!response.ok) {
    const parsed = ApiErrorResponseSchema.safeParse(await response.json().catch(() => undefined));
    if (parsed.success) throw new ApiError(parsed.data.error.code, parsed.data.error.message, response.status);
    throw new ApiError("HTTP_ERROR", "Запит агента завершився помилкою", response.status);
  }
  if (!response.body) throw INVALID_STREAM();

  try {
    await readNdjson(response.body, (value) => {
      const event = AgentEventSchema.safeParse(value);
      if (!event.success) throw INVALID_STREAM();
      onEvent(event.data);
    });
  } catch (error) {
    if (signal.aborted || error instanceof ApiError) throw error;
    if (error instanceof SyntaxError) throw INVALID_STREAM();
    throw new ApiError("STREAM_ERROR", "З’єднання з агентом обірвалося");
  }
};
