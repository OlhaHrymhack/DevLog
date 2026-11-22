import "server-only";
import { AGENT_FINAL_EVENT_TYPES, type AgentEvent } from "@/entities/agentRun";
import { logger } from "../../logger";
import { AGENT_ERRORS } from "./runAgent";

export const NDJSON_CONTENT_TYPE = "application/x-ndjson; charset=utf-8";

export const encodeNdjsonEvent = (event: AgentEvent): string => `${JSON.stringify(event)}\n`;

type StreamTask = (emit: (event: AgentEvent) => void, signal: AbortSignal) => Promise<unknown>;

/**
 * NDJSON-відповідь: `request.signal` і скасування потоку зводяться до одного сигналу запуску.
 * Максимум одна фінальна подія; після неї та після закриття потоку пізні події відкидаються.
 */
export const createNdjsonResponse = (task: StreamTask, requestSignal: AbortSignal): Response => {
  const run = new AbortController();
  const abort = () => run.abort();
  if (requestSignal.aborted) abort();
  else requestSignal.addEventListener("abort", abort, { once: true });

  const encoder = new TextEncoder();
  let closed = false;
  let finalSent = false;

  const stream = new ReadableStream<Uint8Array>({
    start: (controller) => {
      const emit = (event: AgentEvent) => {
        if (closed || finalSent) return;
        finalSent = AGENT_FINAL_EVENT_TYPES.some((type) => type === event.type);
        try {
          controller.enqueue(encoder.encode(encodeNdjsonEvent(event)));
        } catch {
          closed = true;
        }
      };
      const close = () => {
        requestSignal.removeEventListener("abort", abort);
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // Потік уже скасовано клієнтом.
        }
      };
      task(emit, run.signal)
        .catch((error: unknown) => {
          logger.error({ errorName: error instanceof Error ? error.name : "unknown" }, "Agent stream task failed");
          emit({ type: "error", error: AGENT_ERRORS.model });
        })
        .finally(close);
    },
    cancel: () => {
      closed = true;
      abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": NDJSON_CONTENT_TYPE,
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
};
