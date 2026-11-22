import { z } from "zod";

export const AgentStepStateSchema = z.enum(["pending", "run", "done", "fail"]);

export const AgentStepSchema = z.object({
  label: z.string(),
  state: AgentStepStateSchema,
  detail: z.string().optional(),
});
