import type { z } from "zod";
import type {
  AgentRunCreateInputSchema,
  AgentRunFinishInputSchema,
  AgentRunKindSchema,
  AgentRunModeSchema,
  AgentRunSchema,
  AgentRunStatusSchema,
  AgentStepAppendInputSchema,
  AgentStepRecordSchema,
  AgentStepRecordStateSchema,
  AgentStepSchema,
  AgentStepStateSchema,
  AgentStepTypeSchema,
} from "./schemas";

export type AgentStepState = z.infer<typeof AgentStepStateSchema>;
export type AgentStep = z.infer<typeof AgentStepSchema>;

export type AgentRunKind = z.infer<typeof AgentRunKindSchema>;
export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;
export type AgentRunMode = z.infer<typeof AgentRunModeSchema>;
export type AgentStepType = z.infer<typeof AgentStepTypeSchema>;
export type AgentStepRecordState = z.infer<typeof AgentStepRecordStateSchema>;
export type AgentRun = z.infer<typeof AgentRunSchema>;
export type AgentStepRecord = z.infer<typeof AgentStepRecordSchema>;
export type AgentRunCreateInput = z.infer<typeof AgentRunCreateInputSchema>;
export type AgentStepAppendInput = z.infer<typeof AgentStepAppendInputSchema>;
export type AgentRunFinishInput = z.infer<typeof AgentRunFinishInputSchema>;
