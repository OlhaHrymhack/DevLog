import pino, { type DestinationStream, type Logger, type LevelWithSilent } from "pino";
import { getServerEnv } from "@/shared/config/env";

// pino: `*` покриває рівно один рівень, тому кожен секрет перелічено для вкладеності 0–3
// (напр. `err.request.headers`). Глибші структури не логуємо — лише вибрані поля.
// `x-api-key` — заголовок, яким @anthropic-ai/sdk передає ключ.
const SECRET_KEYS = ["apiKey", "ANTHROPIC_API_KEY", "authorization", 'headers["x-api-key"]'];
const NESTING_PREFIXES = ["", "*.", "*.*.", "*.*.*."];
const REDACT_PATHS = NESTING_PREFIXES.flatMap((prefix) =>
  SECRET_KEYS.map((key) => `${prefix}${key}`),
);

type LoggerOptions = {
  level?: LevelWithSilent;
  destination?: DestinationStream;
};

export function createLogger({ level, destination }: LoggerOptions = {}): Logger {
  const options = {
    level: level ?? getServerEnv().LOG_LEVEL,
    redact: { paths: REDACT_PATHS, censor: "[Redacted]" },
  };
  if (destination) {
    return pino(options, destination);
  }
  if (process.env.NODE_ENV === "development") {
    return pino({ ...options, transport: { target: "pino-pretty" } });
  }
  return pino(options);
}

export const logger = createLogger();
