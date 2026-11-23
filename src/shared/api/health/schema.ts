import { z } from "zod";

export const HealthSchema = z.object({
  status: z.literal("ok"),
  aiMode: z.enum(["live", "demo"]),
  agentQuota: z.boolean(),
});

export type Health = z.infer<typeof HealthSchema>;
