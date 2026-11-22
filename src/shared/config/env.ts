import "server-only";
import { z } from "zod";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

const aiModeSchema = z.enum(["live", "demo"]);

export type AiMode = z.infer<typeof aiModeSchema>;

function emptyToUndefined(value: unknown): unknown {
  return value === "" ? undefined : value;
}

export const serverEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  ANTHROPIC_MODEL: z.preprocess(emptyToUndefined, z.string().default("claude-opus-5-5")),
  DATABASE_URL: z.preprocess(emptyToUndefined, z.string().default("file:./data/devlog.db")),
  LOG_LEVEL: z.preprocess(emptyToUndefined, z.enum(LOG_LEVELS).default("info")),
  AI_MODE: z.preprocess(emptyToUndefined, aiModeSchema.optional()),
}).superRefine((env, ctx) => {
  if (env.AI_MODE === "live" && !env.ANTHROPIC_API_KEY) {
    ctx.addIssue({
      code: "custom",
      path: ["ANTHROPIC_API_KEY"],
      message: "required when AI_MODE forces live mode",
    });
  }
});

export type ServerEnv = z.infer<typeof serverEnvSchema> & { aiMode: AiMode };

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".")} — ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server env: ${problems}`);
  }
  const env = result.data;
  const aiMode: AiMode = env.AI_MODE ?? (env.ANTHROPIC_API_KEY ? "live" : "demo");
  return { ...env, aiMode };
}

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cachedEnv ??= parseServerEnv(process.env);
  return cachedEnv;
}
