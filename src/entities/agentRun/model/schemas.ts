import { z } from "zod";

/** UI-стан кроку в прогресі агента (живий прогрес, включно з `pending`/`run`). */
export const AgentStepStateSchema = z.enum(["pending", "run", "done", "fail"]);

export const AgentStepSchema = z.object({
  label: z.string(),
  state: AgentStepStateSchema,
  detail: z.string().optional(),
});

// Persisted-трасування (таблиці `agent_runs` / `agent_steps`).
export const AgentRunKindSchema = z.enum(["prioritize", "decompose", "status-update", "stuck-radar"]);
export const AgentRunStatusSchema = z.enum(["running", "result", "clarify", "fallback", "stopped", "error"]);
export const AgentRunModeSchema = z.enum(["live", "demo"]);
export const AgentStepTypeSchema = z.enum(["model", "tool", "validation"]);
/** У БД пишуться лише завершені кроки. */
export const AgentStepRecordStateSchema = z.enum(["done", "fail"]);

const IsoDateTimeSchema = z.iso.datetime({ offset: true });

export const AgentRunSchema = z.object({
  id: z.string().min(1),
  kind: AgentRunKindSchema,
  taskId: z.string().min(1).nullable(),
  status: AgentRunStatusSchema,
  mode: AgentRunModeSchema,
  startedAt: IsoDateTimeSchema,
  finishedAt: IsoDateTimeSchema.nullable(),
  /** Розібраний JSON; конкретну схему результату валідує агент (DEV-008). */
  result: z.unknown(),
  error: z.unknown(),
});

export const AgentStepRecordSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  index: z.number().int().min(0),
  type: AgentStepTypeSchema,
  label: z.string().trim().min(1).max(200),
  state: AgentStepRecordStateSchema,
  detail: z.string().nullable(),
  payload: z.unknown(),
  createdAt: IsoDateTimeSchema,
});

export const AgentRunCreateInputSchema = z.object({
  kind: AgentRunKindSchema,
  taskId: z.string().min(1).nullable().default(null),
  mode: AgentRunModeSchema,
});

export const AgentStepAppendInputSchema = z.object({
  type: AgentStepTypeSchema,
  label: z.string().trim().min(1).max(200),
  state: AgentStepRecordStateSchema,
  detail: z.string().optional(),
  payload: z.unknown().optional(),
});

/** Завершення run: будь-який статус, крім `running`. */
export const AgentRunFinishInputSchema = z.object({
  status: AgentRunStatusSchema.exclude(["running"]),
  result: z.unknown().optional(),
  error: z.unknown().optional(),
});
