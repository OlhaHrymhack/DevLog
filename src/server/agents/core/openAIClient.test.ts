import OpenAI from "openai";
import type { ChatCompletion } from "openai/resources/chat/completions";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createScriptedClient, scriptedSubmit, selectModelClient } from "./modelClient";
import { createOpenAIClient, fromOpenAICompletion, MAX_COMPLETION_TOKENS, MODEL_TIMEOUT_MS, type ChatCompletionsApi } from "./openAIClient";
import type { ModelRequest } from "./types";

const KEY_MARKER = "dl-test-openai-key-3b9e";

const completion = (message: Partial<ChatCompletion.Choice["message"]>, finishReason: ChatCompletion.Choice["finish_reason"]): ChatCompletion => ({
  id: "chatcmpl-test", object: "chat.completion", created: 0, model: "test-model",
  choices: [{ index: 0, logprobs: null, finish_reason: finishReason, message: { role: "assistant", content: null, refusal: null, ...message } }],
});

const request = (signal = new AbortController().signal): ModelRequest => ({
  system: "Системні інструкції",
  messages: [
    { role: "user", content: "Обери задачу" },
    { role: "assistant", content: "", toolCalls: [{ id: "call_1", name: "get_task", arguments: "{\"id\":\"t1\"}" }] },
    { role: "tool", toolCallId: "call_1", content: "{\"error\":\"не знайдено\"}", isError: true },
  ],
  tools: [{ name: "get_task", description: "Читає задачу", parameters: { type: "object", properties: {}, required: [], additionalProperties: false } }],
  signal,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OpenAIClient: мапінг відповіді", () => {
  it("DEV-008 AC-7: finish_reason tool_calls → tool_use з id, назвою і сирими аргументами", () => {
    const response = fromOpenAICompletion(completion({
      tool_calls: [{ id: "call_9", type: "function", function: { name: "list_tasks", arguments: "{\"status\":null}" } }],
    }, "tool_calls"));
    expect(response).toEqual({ stop: "tool_use", text: "", toolCalls: [{ id: "call_9", name: "list_tasks", arguments: "{\"status\":null}" }] });
  });

  it("DEV-008 AC-7: stop → end, length → max_tokens, content_filter і message.refusal → refusal", () => {
    expect(fromOpenAICompletion(completion({ content: "Готово" }, "stop"))).toEqual({ stop: "end", toolCalls: [], text: "Готово" });
    expect(fromOpenAICompletion(completion({ content: "обрі" }, "length")).stop).toBe("max_tokens");
    expect(fromOpenAICompletion(completion({}, "content_filter")).stop).toBe("refusal");
    expect(fromOpenAICompletion(completion({ refusal: "Не можу допомогти" }, "stop"))).toEqual({ stop: "refusal", toolCalls: [], text: "Не можу допомогти" });
  });
});

describe("OpenAIClient: запит", () => {
  it("DEV-008 AC-7: strict tools, max_completion_tokens, історія з tool-повідомленнями, signal і maxRetries: 0", async () => {
    const create = vi.fn<ChatCompletionsApi["create"]>(async () => completion({ content: "ok" }, "stop"));
    const client = createOpenAIClient({ apiKey: KEY_MARKER, model: "test-model", completions: { create } });
    const signal = new AbortController().signal;
    await client.create(request(signal));

    const [body, options] = create.mock.calls[0] ?? [];
    expect(options).toEqual({ signal, maxRetries: 0, timeout: MODEL_TIMEOUT_MS });
    expect(body).toMatchObject({
      model: "test-model",
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      tool_choice: "auto",
      tools: [{ type: "function", function: { name: "get_task", strict: true } }],
      messages: [
        { role: "system", content: "Системні інструкції" },
        { role: "user", content: "Обери задачу" },
        { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "get_task", arguments: "{\"id\":\"t1\"}" } }] },
        { role: "tool", tool_call_id: "call_1", content: "{\"error\":\"не знайдено\"}" },
      ],
    });
    expect(MAX_COMPLETION_TOKENS).toBe(2048);
  });

  it("DEV-008 AC-7: справжній SDK openai з підміненим fetch: ключ лише в Authorization, без повторів на 500", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify({ error: { message: "boom" } }), { status: 500, headers: { "content-type": "application/json" } }));
    const sdk = new OpenAI({ apiKey: KEY_MARKER, fetch, maxRetries: 5 });
    const client = createOpenAIClient({ apiKey: KEY_MARKER, model: "test-model", completions: sdk.chat.completions });

    await expect(client.create(request())).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = fetch.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${KEY_MARKER}`);
    expect(String(init?.body)).not.toContain(KEY_MARKER);
  });

  it("DEV-008 AC-6 AC-7: abort сигналу перериває запит SDK", async () => {
    const fetch = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));
    const sdk = new OpenAI({ apiKey: KEY_MARKER, fetch });
    const client = createOpenAIClient({ apiKey: KEY_MARKER, model: "test-model", completions: sdk.chat.completions });
    const controller = new AbortController();
    const pending = client.create(request(controller.signal));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("selectModelClient", () => {
  it("DEV-008 AC-7: без ключа (demo) → ScriptedClient, з ключем (live) → OpenAIClient; без мережевих викликів", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const script = vi.fn(() => [scriptedSubmit({ ok: true })]);

    const demo = selectModelClient({ aiMode: "demo", OPENAI_API_KEY: undefined, OPENAI_MODEL: "m" }, script, { delayMs: 0 });
    expect(demo.provider).toBe("scripted");
    expect(script).toHaveBeenCalledTimes(1);

    const live = selectModelClient({ aiMode: "live", OPENAI_API_KEY: KEY_MARKER, OPENAI_MODEL: "m" }, script);
    expect(live.provider).toBe("openai");
    expect(script).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.stringify(live)).not.toContain(KEY_MARKER);

    const forcedDemo = selectModelClient({ aiMode: "demo", OPENAI_API_KEY: KEY_MARKER, OPENAI_MODEL: "m" }, script, { delayMs: 0 });
    expect(forcedDemo.provider).toBe("scripted");
  });

  it("DEV-008 AC-7: ScriptedClient детермінований: віддає сценарій по черзі, далі end", async () => {
    const client = createScriptedClient([scriptedSubmit({ a: 1 })]);
    const signal = new AbortController().signal;
    const base = { system: "", messages: [], tools: [], signal };
    expect((await client.create(base)).toolCalls[0]?.arguments).toBe("{\"a\":1}");
    expect(await client.create(base)).toEqual({ stop: "end", toolCalls: [], text: "" });
  });
});
