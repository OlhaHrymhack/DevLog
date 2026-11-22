import "server-only";
import { z } from "zod";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

const aiModeSchema = z.enum(["live", "demo"]);

export type AiMode = z.infer<typeof aiModeSchema>;

const emptyToUndefined = (value: unknown): unknown => {
  return value === "" ? undefined : value;
};

export const serverEnvSchema = z.object({
  OPENAI_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  OPENAI_MODEL: z.preprocess(emptyToUndefined, z.string().default("gpt-4.1-mini")),
  DATABASE_URL: z.preprocess(emptyToUndefined, z.string().default("file:./data/devlog.db")),
  LOG_LEVEL: z.preprocess(emptyToUndefined, z.enum(LOG_LEVELS).default("info")),
  AI_MODE: z.preprocess(emptyToUndefined, aiModeSchema.optional()),
}).superRefine((env, ctx) => {
  if (env.AI_MODE === "live" && !env.OPENAI_API_KEY) {
    ctx.addIssue({
      code: "custom",
      path: ["OPENAI_API_KEY"],
      message: "required when AI_MODE forces live mode",
    });
  }
});

export type ServerEnv = z.infer<typeof serverEnvSchema> & { aiMode: AiMode };

export const parseServerEnv = (source: Record<string, string | undefined>): ServerEnv => {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".")} — ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server env: ${problems}`);
  }
  const env = result.data;
  const aiMode: AiMode = env.AI_MODE ?? (env.OPENAI_API_KEY ? "live" : "demo");
  return { ...env, aiMode };
};

let cachedEnv: ServerEnv | undefined;

export const getServerEnv = (): ServerEnv => {
  cachedEnv ??= parseServerEnv(process.env);
  return cachedEnv;
};
