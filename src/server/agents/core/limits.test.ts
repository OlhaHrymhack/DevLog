import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatCompletion } from "openai/resources/chat/completions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentEventSchema, MAX_AGENT_STEPS, type AgentEvent } from "@/entities/agentRun";
import { AGENT_MAX_STEPS_BOUNDS, OPENAI_MAX_OUTPUT_TOKENS_BOUNDS } from "@/shared/config/env";
import { readNdjson } from "@/shared/lib/readNdjson";
import { createDb } from "../../db/client";
import { seedDatabase } from "../../db/seed";
import { createLogger } from "../../logger";
import { echoAgent, NOW } from "./__tests__/echoAgent";
import { createAgentRoute, type AgentRouteDeps } from "./agentRoute";
import { scriptedToolCall, selectModelClient } from "./modelClient";
import { createOpenAIClient, MAX_COMPLETION_TOKENS, toOpenAIRequest, type ChatCompletionsApi } from "./openAIClient";
import { FALLBACK_REASONS } from "./runAgent";
import type { ModelClient, ModelRequest } from "./types";

const KEY_MARKER = "dl-test-openai-key-limits-5c2d";
const silent = createLogger({ level: "silent", destination: { write: () => undefined } });

const request = (): ModelRequest => ({ system: "s", messages: [{ role: "user", content: "u" }], tools: [], signal: new AbortController().signal });

const completion = (): ChatCompletion => ({
  id: "chatcmpl-test", object: "chat.completion", created: 0, model: "m",
  choices: [{ index: 0, logprobs: null, finish_reason: "stop", message: { role: "assistant", content: "ok", refusal: null } }],
});

describe("AGENT_MAX_STEPS обмежує цикл", () => {
  let directory: string;
  let connection: ReturnType<typeof createDb>;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "devlog-limits-"));
    connection = createDb(`file:${join(directory, "limits.db")}`);
    seedDatabase(connection.db, NOW);
  });

  afterEach(() => {
    connection.close();
    rmSync(directory, { recursive: true, force: true });
  });

  /** Клієнт, що ніколи не віддає результат: лише читає задачі й лічить виклики. */
  const neverSubmits = () => {
    const state = { calls: 0 };
    const client: ModelClient = {
      provider: "scripted",
      create: async () => {
        state.calls += 1;
        return { stop: "tool_use", text: "", toolCalls: [scriptedToolCall("list_tasks", { status: null })] };
      },
    };
    return { client, state };
  };

  const run = async (agentMaxSteps: number | undefined, overrides: Partial<AgentRouteDeps> = {}) => {
    const { client, state } = neverSubmits();
    const route = createAgentRoute(echoAgent, {
      getDb: () => connection.db,
      getEnv: () => ({ aiMode: "demo", OPENAI_API_KEY: undefined, OPENAI_MODEL: "m", AGENT_MAX_STEPS: agentMaxSteps }),
      createClient: () => client,
      now: () => NOW,
      logger: silent,
      ...overrides,
    });
    const response = await route(new Request("http://localhost/api/agents/prioritize", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: { focus: null } }),
    }));
    const events: AgentEvent[] = [];
    if (!response.body) throw new Error("no body");
    await readNdjson(response.body, (value) => events.push(AgentEventSchema.parse(value)));
    return { calls: state.calls, final: events.at(-1) };
  };

  it("DEV-015 AC-2: AGENT_MAX_STEPS=4 → рівно 4 виклики моделі, далі fallback stepLimit", async () => {
    const { calls, final } = await run(4);
    expect(calls).toBe(4);
    expect(final).toMatchObject({ type: "fallback", reason: FALLBACK_REASONS.stepLimit });
  });

  it("DEV-015 AC-2: значення більше за 8 не перевищує продуктову стелю", async () => {
    const { calls } = await run(100);
    expect(calls).toBe(8);
  });

  it("DEV-015 AC-2: без AGENT_MAX_STEPS діє default 8", async () => {
    const { calls } = await run(undefined);
    expect(calls).toBe(8);
  });
});

describe("OPENAI_MAX_OUTPUT_TOKENS у запиті до OpenAI", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("DEV-015 AC-1: межі в конфігурації збігаються з продуктовими константами D-029", () => {
    expect(AGENT_MAX_STEPS_BOUNDS.max).toBe(MAX_AGENT_STEPS);
    expect(OPENAI_MAX_OUTPUT_TOKENS_BOUNDS.max).toBe(MAX_COMPLETION_TOKENS);
  });

  it("DEV-015 AC-3: maxOutputTokens потрапляє в max_completion_tokens, без нього — 2048", () => {
    expect(toOpenAIRequest("m", request(), 300).max_completion_tokens).toBe(300);
    expect(toOpenAIRequest("m", request()).max_completion_tokens).toBe(MAX_COMPLETION_TOKENS);
    expect(MAX_COMPLETION_TOKENS).toBe(2048);
  });

  it("DEV-015 AC-3: клієнт передає ліміт у виклик і лишає maxRetries: 0", async () => {
    const create = vi.fn<ChatCompletionsApi["create"]>(async () => completion());
    await createOpenAIClient({ apiKey: KEY_MARKER, model: "m", completions: { create }, maxOutputTokens: 400 }).create(request());
    const [body, options] = create.mock.calls[0] ?? [];
    expect(body).toMatchObject({ max_completion_tokens: 400 });
    expect(options).toMatchObject({ maxRetries: 0 });
  });

  it("DEV-015 AC-3: selectModelClient бере ліміт з env і відправляє його справжнім SDK-запитом (fetch підмінено)", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(completion()), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const client = selectModelClient({ aiMode: "live", OPENAI_API_KEY: KEY_MARKER, OPENAI_MODEL: "m", OPENAI_MAX_OUTPUT_TOKENS: 256 }, () => []);
    await client.create(request());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent: unknown = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(sent).toMatchObject({ max_completion_tokens: 256 });
  });
});
