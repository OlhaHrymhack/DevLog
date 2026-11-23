import "server-only";
import { z } from "zod";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

const aiModeSchema = z.enum(["live", "demo"]);

/** Межі лімітів збігаються з продуктовими значеннями D-029 (`MAX_AGENT_STEPS`, `MAX_COMPLETION_TOKENS`); тест їх звіряє. */
export const AGENT_MAX_STEPS_BOUNDS = { min: 1, max: 8 } as const;
export const OPENAI_MAX_OUTPUT_TOKENS_BOUNDS = { min: 64, max: 2048 } as const;

export type AiMode = z.infer<typeof aiModeSchema>;

/** URL віддаленої libSQL; усе інше — локальний SQLite-файл або `:memory:`. */
export const REMOTE_DATABASE_SCHEMES = ["libsql:", "http:", "https:", "ws:", "wss:"] as const;

const emptyToUndefined = (value: unknown): unknown => {
  return value === "" ? undefined : value;
};

export const serverEnvSchema = z.object({
  OPENAI_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  OPENAI_MODEL: z.preprocess(emptyToUndefined, z.string().default("gpt-4.1-mini")),
  DATABASE_URL: z.preprocess(emptyToUndefined, z.string().default("file:./data/devlog.db")),
  /** Токен віддаленої libSQL-бази (Turso); для локального файла не потрібен. */
  DATABASE_AUTH_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  /** `on` вмикає спільну квоту запусків агентів (ізольований Preview); у Vercel Production вона обов'язкова. */
  AGENT_QUOTA: z.preprocess(emptyToUndefined, z.enum(["on", "off"]).optional()),
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

export type ServerEnv = z.infer<typeof serverEnvSchema> & { aiMode: AiMode; agentQuota: boolean };

export const parseServerEnv = (source: Record<string, string | undefined>): ServerEnv => {
  const vercelEnv = source.VERCEL_ENV;
  const production = vercelEnv === "production";
  const preview = vercelEnv === "preview";
  if (source.VERCEL === "1" && !production && !preview && vercelEnv !== "development") {
    throw new Error("Invalid server env: VERCEL_ENV — required on Vercel");
  }

  const database = source.DATABASE_URL
    ? { DATABASE_URL: source.DATABASE_URL, DATABASE_AUTH_TOKEN: source.DATABASE_AUTH_TOKEN }
    : { DATABASE_URL: source.TURSO_DATABASE_URL, DATABASE_AUTH_TOKEN: source.TURSO_AUTH_TOKEN };
  const result = serverEnvSchema.safeParse({
    ...source,
    ...database,
    ...(preview && { AI_MODE: "demo", OPENAI_API_KEY: undefined }),
  });
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".")} — ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server env: ${problems}`);
  }
  const env = result.data;
  if ((production || preview) && !REMOTE_DATABASE_SCHEMES.some((scheme) => env.DATABASE_URL.startsWith(scheme))) {
    throw new Error("Invalid server env: DATABASE_URL — Vercel needs a durable remote libSQL database");
  }
  if (production && env.AGENT_QUOTA === "off") {
    throw new Error("Invalid server env: AGENT_QUOTA — cannot be off in Vercel Production");
  }

  const aiMode: AiMode = env.AI_MODE ?? (env.OPENAI_API_KEY ? "live" : "demo");
  const agentQuota = production || env.AGENT_QUOTA === "on";
  return { ...env, aiMode, agentQuota };
};

let cachedEnv: ServerEnv | undefined;

export const getServerEnv = (): ServerEnv => {
  cachedEnv ??= parseServerEnv(process.env);
  return cachedEnv;
};
