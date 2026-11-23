import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseServerEnv, serverEnvSchema } from "./env";

const KEY_MARKER = "dl-test-key-marker-7f3a";

const errorMessageOf = (source: Record<string, string | undefined>): string => {
  try {
    parseServerEnv(source);
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }
    throw error;
  }
  throw new Error("parseServerEnv did not throw");
};

describe("parseServerEnv: aiMode", () => {
  it("DEV-001 AC-3: без ключа → demo", () => {
    expect(parseServerEnv({}).aiMode).toBe("demo");
  });

  it("DEV-001 AC-3: з ключем → live", () => {
    expect(parseServerEnv({ OPENAI_API_KEY: KEY_MARKER }).aiMode).toBe("live");
  });

  it("DEV-001 AC-3: AI_MODE=demo з ключем → demo", () => {
    expect(parseServerEnv({ OPENAI_API_KEY: KEY_MARKER, AI_MODE: "demo" }).aiMode).toBe("demo");
  });

  it("DEV-001 AC-3: AI_MODE=foo → помилка", () => {
    const message = errorMessageOf({ AI_MODE: "foo" });
    expect(message).toContain("AI_MODE");
    expect(message).not.toContain("foo");
  });

  it("DEV-001 AC-3: порожній OPENAI_API_KEY → demo", () => {
    const env = parseServerEnv({ OPENAI_API_KEY: "", AI_MODE: "" });
    expect(env.aiMode).toBe("demo");
    expect(env.OPENAI_API_KEY).toBeUndefined();
  });

  it("DEV-001 AC-3: AI_MODE=live без ключа → помилка", () => {
    const message = errorMessageOf({ AI_MODE: "live", OPENAI_API_KEY: "" });
    expect(message).toContain("AI_MODE");
    expect(message).toContain("OPENAI_API_KEY");
  });

  it("DEV-001 AC-3: AI_MODE=live з ключем → live, дефолти застосовано", () => {
    const env = parseServerEnv({ AI_MODE: "live", OPENAI_API_KEY: KEY_MARKER });
    expect(env.aiMode).toBe("live");
    expect(env.OPENAI_MODEL).toBe("gpt-4.1-mini");
    expect(env.DATABASE_URL).toBe("file:./data/devlog.db");
    expect(env.LOG_LEVEL).toBe("info");
  });
});

describe("parseServerEnv: invalid env", () => {
  it("DEV-001 AC-4: LOG_LEVEL=loud → помилка з назвою змінної без значень", () => {
    const message = errorMessageOf({ LOG_LEVEL: "loud", OPENAI_API_KEY: KEY_MARKER });
    expect(message).toContain("LOG_LEVEL");
    expect(message).not.toContain("loud");
    expect(message).not.toContain(KEY_MARKER);
  });

  it("DEV-001 AC-4: помилка не несе значень у cause", () => {
    try {
      parseServerEnv({ LOG_LEVEL: "loud", OPENAI_API_KEY: KEY_MARKER });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(JSON.stringify(error, Object.getOwnPropertyNames(error))).not.toContain(KEY_MARKER);
      expect(error instanceof Error ? error.cause : "no-error").toBeUndefined();
      return;
    }
    throw new Error("parseServerEnv did not throw");
  });
});

const parseEnvExample = (content: string) => {
  const lines = content.split(/\r?\n/);
  const entries: { key: string; value: string; commentAbove: boolean }[] = [];
  lines.forEach((line, index) => {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (!match) {
      return;
    }
    const previous = lines[index - 1]?.trim() ?? "";
    entries.push({ key: match[1] ?? "", value: match[2] ?? "", commentAbove: previous.startsWith("#") });
  });
  return entries;
};

describe(".env.example", () => {
  it("DEV-001 AC-7: .env.example містить рівно ключі serverEnvSchema з порожніми значеннями і коментарями", () => {
    const content = readFileSync(path.resolve(__dirname, "../../../.env.example"), "utf8");
    const entries = parseEnvExample(content);

    expect(entries.map((entry) => entry.key).sort()).toEqual(Object.keys(serverEnvSchema.shape).sort());
    for (const entry of entries) {
      expect(entry.value, `${entry.key} must be empty`).toBe("");
      expect(entry.commentAbove, `${entry.key} must have a comment above`).toBe(true);
    }
  });
});

describe("спільна квота Vercel", () => {
  const turso = { TURSO_DATABASE_URL: "libsql://fixtures.example.test", TURSO_AUTH_TOKEN: "test-token" };

  it("DEV-017 AC-3: використовує змінні інтеграції Turso як пару", () => {
    const production = parseServerEnv({ VERCEL: "1", VERCEL_ENV: "production", ...turso });
    expect(production).toMatchObject({ DATABASE_URL: turso.TURSO_DATABASE_URL, DATABASE_AUTH_TOKEN: turso.TURSO_AUTH_TOKEN });
    const explicit = parseServerEnv({ ...turso, DATABASE_URL: "file:./data/custom.db" });
    expect(explicit.DATABASE_URL).toBe("file:./data/custom.db");
    expect(explicit.DATABASE_AUTH_TOKEN).toBeUndefined();
  });

  it("DEV-017 AC-4: Vercel Production потребує спільної бази та квоти", () => {
    expect(parseServerEnv({ VERCEL_ENV: "production", ...turso }).agentQuota).toBe(true);
    expect(errorMessageOf({ VERCEL_ENV: "production" })).toContain("DATABASE_URL");
    expect(errorMessageOf({ VERCEL_ENV: "production", ...turso, AGENT_QUOTA: "off" })).toContain("AGENT_QUOTA");
    expect(errorMessageOf({ VERCEL: "1", ...turso })).toContain("VERCEL_ENV");
  });

  it("DEV-017 AC-5: Preview працює в деморежимі навіть із випадково заданим ключем", () => {
    const preview = parseServerEnv({
      VERCEL_ENV: "preview", AI_MODE: "live", OPENAI_API_KEY: KEY_MARKER, AGENT_QUOTA: "on", ...turso,
    });
    expect(preview).toMatchObject({ aiMode: "demo", agentQuota: true });
    expect(preview.OPENAI_API_KEY).toBeUndefined();
    expect(errorMessageOf({ VERCEL_ENV: "preview" })).toContain("DATABASE_URL");
  });
});
