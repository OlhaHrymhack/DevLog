import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env";

const messageOf = (source: Record<string, string | undefined>): string => {
  try {
    parseServerEnv(source);
  } catch (error) {
    if (error instanceof Error) return error.message;
    throw error;
  }
  throw new Error("parseServerEnv did not throw");
};

describe("ліміти агентів в env", () => {
  it("DEV-015 AC-1: без значень — продуктові default 8 кроків і 2048 токенів, AI_SMOKE не заданий", () => {
    const env = parseServerEnv({});
    expect(env.AGENT_MAX_STEPS).toBe(8);
    expect(env.OPENAI_MAX_OUTPUT_TOKENS).toBe(2048);
    expect(env.AI_SMOKE).toBeUndefined();
  });

  it("DEV-015 AC-1: порожні рядки з .env.example трактуються як «не задано»", () => {
    const env = parseServerEnv({ AGENT_MAX_STEPS: "", OPENAI_MAX_OUTPUT_TOKENS: "", AI_SMOKE: "" });
    expect(env).toMatchObject({ AGENT_MAX_STEPS: 8, OPENAI_MAX_OUTPUT_TOKENS: 2048 });
  });

  it("DEV-015 AC-1: коректні значення приймаються на межах діапазонів", () => {
    expect(parseServerEnv({ AGENT_MAX_STEPS: "1", OPENAI_MAX_OUTPUT_TOKENS: "64" })).toMatchObject({ AGENT_MAX_STEPS: 1, OPENAI_MAX_OUTPUT_TOKENS: 64 });
    expect(parseServerEnv({ AGENT_MAX_STEPS: "4", OPENAI_MAX_OUTPUT_TOKENS: "400", AI_SMOKE: "1" })).toMatchObject({ AGENT_MAX_STEPS: 4, OPENAI_MAX_OUTPUT_TOKENS: 400, AI_SMOKE: "1" });
  });

  it.each([
    ["AGENT_MAX_STEPS", "0"],
    ["AGENT_MAX_STEPS", "9"],
    ["AGENT_MAX_STEPS", "2.5"],
    ["AGENT_MAX_STEPS", "abc"],
    ["OPENAI_MAX_OUTPUT_TOKENS", "63"],
    ["OPENAI_MAX_OUTPUT_TOKENS", "2049"],
    ["OPENAI_MAX_OUTPUT_TOKENS", "-5"],
    ["AI_SMOKE", "yes"],
  ])("DEV-015 AC-1: %s=%s → помилка старту з назвою змінної", (name, value) => {
    expect(messageOf({ [name]: value })).toContain(name);
  });

  it("DEV-015 AC-8: .env.example описує всі нові змінні й попереджає про вартість smoke", () => {
    const example = readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
    for (const name of ["AGENT_MAX_STEPS", "OPENAI_MAX_OUTPUT_TOKENS", "AI_SMOKE"]) {
      expect(example).toMatch(new RegExp(`^${name}=$`, "m"));
    }
    expect(example).toMatch(/costs real API tokens/);
    expect(example).toMatch(/npm run smoke:ai/);
  });
});
