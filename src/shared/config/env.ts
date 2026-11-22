import "server-only";
import { z } from "zod";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

const aiModeSchema = z.enum(["live", "demo"]);

/** Межі лімітів збігаються з продуктовими значеннями D-029 (`MAX_AGENT_STEPS`, `MAX_COMPLETION_TOKENS`); тест їх звіряє. */
export const AGENT_MAX_STEPS_BOUNDS = { min: 1, max: 8 } as const;
export const OPENAI_MAX_OUTPUT_TOKENS_BOUNDS = { min: 64, max: 2048 } as const;

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
  AGENT_MAX_STEPS: z.preprocess(emptyToUndefined, z.coerce.number().int()
    .min(AGENT_MAX_STEPS_BOUNDS.min).max(AGENT_MAX_STEPS_BOUNDS.max).default(AGENT_MAX_STEPS_BOUNDS.max)),
  OPENAI_MAX_OUTPUT_TOKENS: z.preprocess(emptyToUndefined, z.coerce.number().int()
    .min(OPENAI_MAX_OUTPUT_TOKENS_BOUNDS.min).max(OPENAI_MAX_OUTPUT_TOKENS_BOUNDS.max).default(OPENAI_MAX_OUTPUT_TOKENS_BOUNDS.max)),
  /** `1` вмикає dev-only маршрут платного smoke-запиту; у production маршрут завжди 404. */
  AI_SMOKE: z.preprocess(emptyToUndefined, z.enum(["0", "1"]).optional()),
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
