import { z } from "zod";
import { AgentRunModeSchema, AgentStepStateSchema } from "./schemas";

/** Ліміт викликів моделі на один запуск агента (включно з повтором і нагадуванням). */
export const MAX_AGENT_STEPS = 8;

export const AgentErrorSchema = z.object({ code: z.string(), message: z.string() });

/** Події NDJSON-стріму запуску: `run` → `step`… → рівно одна фінальна (`result` | `fallback` | `stopped` | `error`). */
export const AgentEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("run"),
    runId: z.string().min(1),
    mode: AgentRunModeSchema,
    steps: z.array(z.object({ label: z.string() })),
  }),
  z.object({
    type: z.literal("step"),
    index: z.number().int().min(0),
    label: z.string(),
    state: AgentStepStateSchema,
    detail: z.string().optional(),
  }),
  z.object({ type: z.literal("result"), status: z.enum(["result", "clarify"]), data: z.unknown() }),
  z.object({ type: z.literal("fallback"), reason: z.string(), data: z.unknown() }),
  z.object({ type: z.literal("stopped") }),
  z.object({ type: z.literal("error"), error: AgentErrorSchema }),
]);

export const AGENT_FINAL_EVENT_TYPES = ["result", "fallback", "stopped", "error"] as const;

export const AgentDebugSchema = z.strictObject({ forceInvalidOutput: z.boolean() });

/**
 * Конверт тіла POST-запиту агента; `input` далі перевіряє `inputSchema` конкретного агента.
 * `debug` (fault injection) дозволене лише поза production: у production строга схема відкидає це поле → 400.
 */
export const createAgentRequestSchema = ({ allowDebug }: { allowDebug: boolean }) =>
  z.strictObject({
    input: z.unknown(),
    debug: allowDebug ? AgentDebugSchema.optional() : z.never().optional(),
  });
