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
    expect(parseServerEnv({ ANTHROPIC_API_KEY: KEY_MARKER }).aiMode).toBe("live");
  });

  it("DEV-001 AC-3: AI_MODE=demo з ключем → demo", () => {
    expect(parseServerEnv({ ANTHROPIC_API_KEY: KEY_MARKER, AI_MODE: "demo" }).aiMode).toBe("demo");
  });

  it("DEV-001 AC-3: AI_MODE=foo → помилка", () => {
    const message = errorMessageOf({ AI_MODE: "foo" });
    expect(message).toContain("AI_MODE");
    expect(message).not.toContain("foo");
  });

  it("DEV-001 AC-3: порожній ANTHROPIC_API_KEY → demo", () => {
    const env = parseServerEnv({ ANTHROPIC_API_KEY: "", AI_MODE: "" });
    expect(env.aiMode).toBe("demo");
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("DEV-001 AC-3: AI_MODE=live без ключа → помилка", () => {
    const message = errorMessageOf({ AI_MODE: "live", ANTHROPIC_API_KEY: "" });
    expect(message).toContain("AI_MODE");
    expect(message).toContain("ANTHROPIC_API_KEY");
  });

  it("DEV-001 AC-3: AI_MODE=live з ключем → live, дефолти застосовано", () => {
    const env = parseServerEnv({ AI_MODE: "live", ANTHROPIC_API_KEY: KEY_MARKER });
    expect(env.aiMode).toBe("live");
    expect(env.ANTHROPIC_MODEL).toBe("claude-opus-5-5");
    expect(env.DATABASE_URL).toBe("file:./data/devlog.db");
    expect(env.LOG_LEVEL).toBe("info");
  });
});

describe("parseServerEnv: invalid env", () => {
  it("DEV-001 AC-4: LOG_LEVEL=loud → помилка з назвою змінної без значень", () => {
    const message = errorMessageOf({ LOG_LEVEL: "loud", ANTHROPIC_API_KEY: KEY_MARKER });
    expect(message).toContain("LOG_LEVEL");
    expect(message).not.toContain("loud");
    expect(message).not.toContain(KEY_MARKER);
  });

  it("DEV-001 AC-4: помилка не несе значень у cause", () => {
    try {
      parseServerEnv({ LOG_LEVEL: "loud", ANTHROPIC_API_KEY: KEY_MARKER });
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
