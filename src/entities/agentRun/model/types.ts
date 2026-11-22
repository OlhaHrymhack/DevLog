import type { z } from "zod";
import type { AgentStepSchema, AgentStepStateSchema } from "./schemas";

export type AgentStepState = z.infer<typeof AgentStepStateSchema>;
export type AgentStep = z.infer<typeof AgentStepSchema>;
