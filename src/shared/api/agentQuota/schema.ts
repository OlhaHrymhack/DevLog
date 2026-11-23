import { z } from "zod";

export const PublicQuotaKindSchema = z.enum(["prioritize", "stuck-radar", "voice-draft"]);

export const AgentQuotaSchema = z.discriminatedUnion("enabled", [
  z.object({ enabled: z.literal(false) }),
  z.object({
    enabled: z.literal(true),
    limit: z.number().int().positive(),
    used: z.record(PublicQuotaKindSchema, z.number().int().nonnegative()),
  }),
]);

export type AgentQuota = z.infer<typeof AgentQuotaSchema>;
