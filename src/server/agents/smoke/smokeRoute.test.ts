import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentEventSchema, type AgentEvent } from "@/entities/agentRun";
import { readNdjson } from "@/shared/lib/readNdjson";
import { createDb } from "../../db/client";
import { seedDatabase } from "../../db/seed";
import { agentRuns } from "../../agentRuns/schema";
import { tasks } from "../../tasks/schema";
import { createLogger } from "../../logger";
import { NOW } from "../core/__tests__/echoAgent";
import { createScriptedClient, scriptedSubmit, scriptedToolCall, scriptedTurn } from "../core/modelClient";
import type { ModelClient } from "../core/types";
import { SMOKE_TOKEN_HEADER } from "./smokeToken";
import { createSmokeRoute, SMOKE_MAX_OUTPUT_TOKENS, SMOKE_MAX_STEPS, type SmokeEnv, type SmokeLimits, type SmokeRouteDeps } from "./smokeRoute";

const KEY_MARKER = "dl-test-openai-key-smoke-9a41";
const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
const LIVE_ENV: SmokeEnv = { aiMode: "live", OPENAI_API_KEY: KEY_MARKER, OPENAI_MODEL: "m", AGENT_MAX_STEPS: 8, OPENAI_MAX_OUTPUT_TOKENS: 2048, AI_SMOKE: "1" };

let connection: Awaited<ReturnType<typeof createDb>>;
let logLines: string[];
let createClientCalls: SmokeLimits[];
let firstTask: { id: string; title: string };

const logger = () => createLogger({ level: "debug", destination: { write: (line: string) => { logLines.push(line); } } });

beforeEach(async () => {
  connection = await createDb(":memory:");
  await seedDatabase(connection.db, NOW);
  firstTask = (await connection.db.select().from(tasks).limit(1).all())[0] ?? { id: "missing", title: "missing" };
  logLines = [];
  createClientCalls = [];
});

afterEach(() => {
  connection.close();
  vi.restoreAllMocks();
});

const firstTaskId = () => firstTask.id;

const deps = (overrides: Partial<SmokeRouteDeps> = {}): SmokeRouteDeps => ({
  getDb: () => connection.db,
  getEnv: () => LIVE_ENV,
  getToken: () => TOKEN,
  nodeEnv: () => "development",
  createClient: (_env, limits): ModelClient => {
    createClientCalls.push(limits);
    return createScriptedClient([
      scriptedTurn(scriptedToolCall("list_tasks", { status: null })),
      scriptedSubmit({ taskId: firstTaskId(), summary: "Перша задача" }),
    ]);
  },
  logger: logger(),
  ...overrides,
});

type PostOptions = { url?: string; headers?: Record<string, string>; body?: string };

const BASE_HEADERS = { "Content-Type": "application/json", [SMOKE_TOKEN_HEADER]: TOKEN };

const post = ({ url = "http://localhost:3000/api/dev/agent-smoke", headers = {}, body = "{}" }: PostOptions = {}) =>
  new Request(url, { method: "POST", headers: { ...BASE_HEADERS, ...headers }, body });

const firstTaskTitle = () => firstTask.title;

const readEvents = async (response: Response): Promise<AgentEvent[]> => {
  const events: AgentEvent[] = [];
  if (!response.body) throw new Error("no body");
  await readNdjson(response.body, (value) => events.push(AgentEventSchema.parse(value)));
  return events;
};

const FINAL = ["result", "fallback", "stopped", "error"];

describe("smoke-маршрут: захист до виклику моделі", () => {
  const cases: [string, Partial<SmokeRouteDeps>, PostOptions, number, string][] = [
    ["production", { nodeEnv: () => "production" }, {}, 404, "NOT_FOUND"],
    ["AI_SMOKE не задано", { getEnv: () => ({ ...LIVE_ENV, AI_SMOKE: undefined }) }, {}, 404, "NOT_FOUND"],
    ["AI_SMOKE=0", { getEnv: () => ({ ...LIVE_ENV, AI_SMOKE: "0" }) }, {}, 404, "NOT_FOUND"],
    ["чужий хост", {}, { url: "http://evil.example/api/dev/agent-smoke" }, 403, "FORBIDDEN"],
    ["Host: evil.example при URL localhost (як у реальному Next)", {}, { headers: { Host: "evil.example" } }, 403, "FORBIDDEN"],
    ["Host із LAN-адресою", {}, { headers: { Host: "192.168.1.20:3000" } }, 403, "FORBIDDEN"],
    ["Origin чужого сайту", {}, { headers: { Origin: "http://evil.example" } }, 403, "FORBIDDEN"],
    ["порожній токен", {}, { headers: { [SMOKE_TOKEN_HEADER]: "" } }, 403, "FORBIDDEN"],
    ["токен із не-ASCII символами тієї ж довжини", {}, { headers: { [SMOKE_TOKEN_HEADER]: "é".repeat(64) } }, 403, "FORBIDDEN"],
    ["порожній очікуваний токен (пошкоджений файл)", { getToken: () => "" }, { headers: { [SMOKE_TOKEN_HEADER]: "" } }, 403, "FORBIDDEN"],
    ["хибний токен", {}, { headers: { [SMOKE_TOKEN_HEADER]: "wrong-token" } }, 403, "FORBIDDEN"],
    ["cross-site", {}, { headers: { "Sec-Fetch-Site": "cross-site" } }, 403, "FORBIDDEN"],
    ["не JSON", {}, { headers: { "Content-Type": "text/plain" } }, 415, "UNSUPPORTED_MEDIA_TYPE"],
    ["demo-режим", { getEnv: () => ({ ...LIVE_ENV, aiMode: "demo", OPENAI_API_KEY: undefined }) }, {}, 409, "AI_NOT_LIVE"],
  ];

  it.each(cases)("DEV-015 AC-4: %s → відмова без виклику моделі", async (_name, overrides, options, status, code) => {
    const createClient = vi.fn(deps().createClient);
    const response = await createSmokeRoute(deps({ createClient, ...overrides }))(post(options));
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ error: { code } });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("DEV-015 AC-4: localhost-хост і Origin, same-origin та правильний токен дозволені", async () => {
    const response = await createSmokeRoute(deps())(post({
      url: "http://127.0.0.1:3000/api/dev/agent-smoke",
      headers: { Host: "localhost:3000", Origin: "http://localhost:3000", "Sec-Fetch-Site": "same-origin" },
    }));
    expect(response.status).toBe(200);
    await readEvents(response);
  });

  it("DEV-015 AC-4: непорожнє тіло → 400 валідації без виклику моделі", async () => {
    const createClient = vi.fn(deps().createClient);
    const response = await createSmokeRoute(deps({ createClient }))(post({ body: JSON.stringify({ taskId: "x" }) }));
    expect(response.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("DEV-015 AC-4: одночасні запити (Promise.all) → один запуск моделі, інший 409 SMOKE_BUSY; після завершення знову дозволено", async () => {
    const route = createSmokeRoute(deps());
    const [a, b] = await Promise.all([route(post()), route(post())]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(createClientCalls).toHaveLength(1);
    const busy = a.status === 409 ? a : b;
    expect(await busy.json()).toMatchObject({ error: { code: "SMOKE_BUSY" } });
    await readEvents(a.status === 200 ? a : b);

    const next = await route(post());
    expect(next.status).toBe(200);
    await readEvents(next);
  });

  it("DEV-015 AC-4: запит без заголовка токена → 403 без виклику моделі", async () => {
    const createClient = vi.fn(deps().createClient);
    const request = new Request("http://localhost:3000/api/dev/agent-smoke", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    expect((await createSmokeRoute(deps({ createClient }))(request)).status).toBe(403);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("DEV-015 AC-4: скасування потоку клієнтом звільняє busy", async () => {
    const abort = new AbortController();
    const slow = deps({
      createClient: () => ({
        provider: "scripted",
        create: ({ signal }) => new Promise((_resolve, reject) => { signal.addEventListener("abort", () => reject(signal.reason), { once: true }); }),
      }),
    });
    const route = createSmokeRoute(slow);
    const first = await route(new Request("http://localhost:3000/api/dev/agent-smoke", { method: "POST", headers: BASE_HEADERS, body: "{}", signal: abort.signal }));
    expect(first.status).toBe(200);
    expect((await route(post())).status).toBe(409);

    abort.abort();
    await first.body?.cancel().catch(() => undefined);
    await vi.waitFor(async () => {
      const next = await route(post());
      expect(next.status).not.toBe(409);
      await next.body?.cancel();
    });
  });

  it("DEV-015 AC-4: помилка до старту запуску (тіло, створення клієнта) звільняє busy", async () => {
    let fail = true;
    const route = createSmokeRoute(deps({
      createClient: (env, limits) => {
        if (fail) throw new Error("boom");
        return deps().createClient?.(env, limits) ?? createScriptedClient([]);
      },
    }));
    expect((await route(post({ body: JSON.stringify({ x: 1 }) }))).status).toBe(400);
    expect((await route(post())).status).toBe(500);
    fail = false;
    const recovered = await route(post());
    expect(recovered.status).toBe(200);
    await readEvents(recovered);
  });
});

describe("smoke-маршрут: обмежений запуск", () => {
  it("DEV-015 AC-5: ліміти min(env, 4) і min(env, 400) передаються в клієнт", async () => {
    await readEvents(await createSmokeRoute(deps())(post()));
    expect(createClientCalls).toEqual([{ maxSteps: SMOKE_MAX_STEPS, maxOutputTokens: SMOKE_MAX_OUTPUT_TOKENS }]);
    expect([SMOKE_MAX_STEPS, SMOKE_MAX_OUTPUT_TOKENS]).toEqual([4, 400]);

    createClientCalls = [];
    const lower = deps({ getEnv: () => ({ ...LIVE_ENV, AGENT_MAX_STEPS: 2, OPENAI_MAX_OUTPUT_TOKENS: 128 }) });
    await readEvents(await createSmokeRoute(lower)(post()));
    expect(createClientCalls).toEqual([{ maxSteps: 2, maxOutputTokens: 128 }]);
  });

  it("DEV-015 AC-5: модель, що не віддає результат, робить не більше 4 викликів → fallback і рівно одна фінальна подія", async () => {
    let calls = 0;
    const stubborn = deps({
      createClient: () => ({
        provider: "scripted",
        create: async () => {
          calls += 1;
          return { stop: "tool_use", text: "", toolCalls: [scriptedToolCall("list_tasks", { status: null })] };
        },
      }),
    });
    const events = await readEvents(await createSmokeRoute(stubborn)(post()));
    expect(calls).toBe(4);
    expect(events.filter((event) => FINAL.includes(event.type))).toHaveLength(1);
    expect(events.at(-1)?.type).toBe("fallback");
  });

  it("DEV-015 AC-5: успіх — події run → step… → result, траса не потрапляє в БД користувача", async () => {
    const events = await readEvents(await createSmokeRoute(deps())(post()));
    expect(events[0]?.type).toBe("run");
    expect(events.slice(1, -1).every((event) => event.type === "step")).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: "result", data: { taskId: firstTaskId() } });
    expect(events.filter((event) => FINAL.includes(event.type))).toHaveLength(1);
    expect(await connection.db.select().from(agentRuns).all()).toHaveLength(0);
  });
});

describe("smoke-маршрут: відсутність витоку", () => {
  it("DEV-015 AC-6: ключ не потрапляє у відповіді, заголовки й логи жодної гілки", async () => {
    const responses = await Promise.all([
      createSmokeRoute(deps())(post()),
      createSmokeRoute(deps({ nodeEnv: () => "production" }))(post()),
      createSmokeRoute(deps())(post({ url: "http://evil.example/x" })),
      createSmokeRoute(deps())(post({ headers: { "Content-Type": "text/plain" } })),
      createSmokeRoute(deps())(post({ headers: { [SMOKE_TOKEN_HEADER]: "wrong" } })),
      createSmokeRoute(deps({ createClient: () => { throw new Error("boom"); } }))(post()),
    ]);
    const dumps: string[] = [];
    for (const response of responses) {
      dumps.push(JSON.stringify([...response.headers.entries()]), await response.text());
    }
    const everything = [...dumps, ...logLines].join("\n");
    expect(everything).not.toContain(KEY_MARKER);
    expect(everything).not.toContain(TOKEN);
    expect(logLines.length).toBeGreaterThan(0);
  });

  it("DEV-015 AC-6: у відповіді smoke немає системного промпту й повних даних задач", async () => {
    const response = await createSmokeRoute(deps())(post());
    const body = await response.text();
    expect(body).not.toContain("технічна перевірка зв'язку");
    expect(body).not.toContain("Обери одну задачу зі списку");
    const title = firstTaskTitle();
    expect(title.length).toBeGreaterThan(5);
    expect(body).not.toContain(title);
    expect(logLines.join("\n")).not.toContain(title);
    expect(body).not.toContain(TOKEN);
  });
});
