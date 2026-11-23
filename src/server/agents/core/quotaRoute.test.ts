import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentEventSchema, type AgentEvent } from "@/entities/agentRun";
import { readNdjson } from "@/shared/lib/readNdjson";
import { AGENT_RUN_QUOTA, createAgentQuotaRepository } from "../../agentQuota/repository";
import { createDb, type DbConnection } from "../../db/client";
import { seedDatabase } from "../../db/seed";
import { createLogger, logger } from "../../logger";
import { decomposeAgent } from "../decompose/decomposeAgent";
import { statusUpdateAgent } from "../statusUpdate/statusUpdateAgent";
import { echoAgent, NOW } from "./__tests__/echoAgent";
import { createAgentRoute, type AgentRouteDeps } from "./agentRoute";
import { createScriptedClient } from "./modelClient";
import type { ModelClient, ScriptedTurn } from "./types";

const QUOTA_ENV = { aiMode: "demo", OPENAI_API_KEY: undefined, OPENAI_MODEL: "test", agentQuota: true } as const;
const silent = createLogger({ level: "silent", destination: { write: () => undefined } });

let directory: string;
let file: string;
let connection: DbConnection;
let modelCalls: number;
let clientsCreated: number;

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "devlog-quota-route-"));
  file = join(directory, "quota.db");
  connection = await createDb(file);
  await seedDatabase(connection.db, NOW);
  modelCalls = 0;
  clientsCreated = 0;
  vi.spyOn(logger, "info").mockImplementation(() => undefined);
  vi.spyOn(logger, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  connection.close();
  rmSync(directory, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** Підмінений клієнт моделі: рахує створення й виклики, щоб довести «нуль викликів» для відхилених запитів. */
const countingClient = (script: () => readonly ScriptedTurn[]): ModelClient => {
  clientsCreated += 1;
  const inner = createScriptedClient(script());
  return { provider: "scripted", create: (request) => { modelCalls += 1; return inner.create(request); } };
};

const deps = (overrides: Partial<AgentRouteDeps> = {}): AgentRouteDeps => ({
  getDb: () => connection.db,
  getEnv: () => QUOTA_ENV,
  createClient: (_env, script) => countingClient(script),
  now: () => NOW,
  logger: silent,
  ...overrides,
});

const post = (body: unknown, signal?: AbortSignal) => new Request("http://localhost/api/agents/prioritize", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal,
});

const drain = async (response: Response): Promise<AgentEvent[]> => {
  const events: AgentEvent[] = [];
  if (response.body) await readNdjson(response.body, (value) => events.push(AgentEventSchema.parse(value)));
  return events;
};

const usage = (kind: Parameters<ReturnType<typeof createAgentQuotaRepository>["getUsage"]>[0]) =>
  createAgentQuotaRepository(connection.db).getUsage(kind);

describe("квота запусків агента в спільному обробнику", () => {
  it.each(["prioritize", "stuck-radar"] as const)("%s приймає 150 запусків, 151-й → 429 без створення клієнта моделі", async (kind) => {
    const route = createAgentRoute({ ...echoAgent, kind }, deps());
    for (let index = 0; index < AGENT_RUN_QUOTA; index += 1) {
      const response = await route(post({ input: { focus: null } }));
      expect(response.status).toBe(200);
      expect((await drain(response)).at(-1)?.type).toBe("result");
    }
    const callsBefore = { modelCalls, clientsCreated };
    const rejected = await route(post({ input: { focus: null } }));
    expect(rejected.status).toBe(429);
    expect(await rejected.json()).toEqual({ error: { code: "AGENT_QUOTA_EXHAUSTED", message: expect.stringContaining("150") } });
    expect({ modelCalls, clientsCreated }).toEqual(callsBefore);
    expect(await usage(kind)).toBe(AGENT_RUN_QUOTA);
  });

  it("паралельні запити через різні з'єднання не перевищують межу", async () => {
    const instances = await Promise.all(Array.from({ length: 6 }, () => createDb(file)));
    try {
      const routes = instances.map((instance) => createAgentRoute(echoAgent, deps({ getDb: () => instance.db })));
      const responses = await Promise.all(Array.from({ length: AGENT_RUN_QUOTA + 8 }, (_, index) =>
        routes[index % routes.length]?.(post({ input: { focus: null } }))));
      const statuses = responses.map((response) => response?.status);
      await Promise.all(responses.map((response) => response && response.status === 200 ? drain(response) : undefined));
      expect(statuses.filter((status) => status === 200)).toHaveLength(AGENT_RUN_QUOTA);
      expect(statuses.filter((status) => status === 429)).toHaveLength(8);
      expect(clientsCreated).toBe(AGENT_RUN_QUOTA);
      expect(await usage("prioritize")).toBe(AGENT_RUN_QUOTA);
    } finally {
      instances.forEach((instance) => instance.close());
    }
  });

  it("DEV-017 AC-4: невалідний запит відхиляється 400 до резервування й нічого не витрачає", async () => {
    const route = createAgentRoute(echoAgent, deps());
    for (const body of [{}, { input: { focus: 5 } }, { input: { focus: null }, extra: true }]) {
      expect((await route(post(body))).status).toBe(400);
    }
    expect(await usage("prioritize")).toBe(0);
    expect(clientsCreated).toBe(0);
  });

  it("DEV-017 AC-4: скасування або помилка після резервування не повертає спробу", async () => {
    const controller = new AbortController();
    const started = Promise.withResolvers<void>();
    const hanging: ModelClient = {
      provider: "scripted",
      create: ({ signal }) => new Promise((_resolve, reject) => {
        started.resolve();
        signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
    };
    const cancelled = await createAgentRoute(echoAgent, deps({ createClient: () => hanging }))(post({ input: { focus: null } }, controller.signal));
    const events = drain(cancelled);
    await started.promise;
    controller.abort();
    expect((await events).at(-1)).toEqual({ type: "stopped" });

    const failing: ModelClient = { provider: "scripted", create: async () => { throw new Error("provider down"); } };
    const failed = await createAgentRoute(echoAgent, deps({ createClient: () => failing }))(post({ input: { focus: null } }));
    expect((await drain(failed)).at(-1)).toMatchObject({ type: "error" });
    expect(await usage("prioritize")).toBe(2);
  });

  it("DEV-017 AC-5: недоступне сховище квоти → 503, модель не створюється й не викликається", async () => {
    const broken = await createDb(join(directory, "broken.db"));
    broken.close();
    for (const override of [{ getDb: () => broken.db }, { getDb: async () => { throw new Error("libsql unreachable"); } }]) {
      const response = await createAgentRoute(echoAgent, deps(override))(post({ input: { focus: null } }));
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ error: { code: "AGENT_QUOTA_UNAVAILABLE" } });
    }
    expect({ clientsCreated, modelCalls }).toEqual({ clientsCreated: 0, modelCalls: 0 });
  });

  it("DEV-017 AC-5: відкриття бази після таймауту вже не резервує спробу", async () => {
    const opening = Promise.withResolvers<DbConnection["db"]>();
    const route = createAgentRoute(echoAgent, deps({ getDb: () => opening.promise, quotaTimeoutMs: 10 }));
    const response = await route(post({ input: { focus: null } }));
    expect(response.status).toBe(503);

    opening.resolve(connection.db);
    await new Promise((resolve) => setImmediate(resolve));
    expect(await usage("prioritize")).toBe(0);
    expect(clientsCreated).toBe(0);
  });

  it("DEV-017 AC-5: без увімкненої квоти (локально й у Docker) лічильник не пишеться", async () => {
    const route = createAgentRoute(echoAgent, deps({ getEnv: () => ({ ...QUOTA_ENV, agentQuota: false }) }));
    for (let index = 0; index < AGENT_RUN_QUOTA + 1; index += 1) await drain(await route(post({ input: { focus: null } })));
    expect(await usage("prioritize")).toBe(0);
  });
});

const postTo = (kind: string, input: unknown) => new Request(`http://localhost/api/agents/${kind}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input }),
});

describe("квота: перевірка входу й межа очікування сховища", () => {
  it("DEV-019 AC-3: статус-апдейт доступний із квотою та витрачає одну спробу", async () => {
    const status = await createAgentRoute(statusUpdateAgent, deps())(postTo("status-update", { taskId: "t7", tone: "team" }));
    expect(status.status).toBe(200);
    expect((await drain(status)).at(-1)?.type).toBe("result");
    expect(await usage("status-update")).toBe(1);
  });

  it("запуск декомпозиції з вимкненою квотою не витрачає спробу", async () => {
    const response = await createAgentRoute(decomposeAgent, deps({ getEnv: () => ({ ...QUOTA_ENV, agentQuota: false }) }))(
      postTo("decompose", { taskId: "t7" }),
    );
    expect(response.status).toBe(200);
    await drain(response);
    expect(await usage("decompose")).toBe(0);
  });

  it("декомпозиція резервує спільну квоту лише для наявних задач та відхиляє 151-й запуск", async () => {
    const broken = await createDb(join(directory, "broken-check.db"));
    broken.close();
    const failed = await createAgentRoute(decomposeAgent, deps({ getDb: () => broken.db }))(postTo("decompose", { taskId: "t7" }));
    expect(failed.status).toBe(503);

    const route = createAgentRoute(decomposeAgent, deps());
    const quota = createAgentQuotaRepository(connection.db);
    for (let index = 0; index < AGENT_RUN_QUOTA - 1; index += 1) await quota.reserve("prioritize");
    const missing = await route(postTo("decompose", { taskId: "ghost-task" }));
    expect(missing.status).toBe(404);
    expect({ clientsCreated, modelCalls }).toEqual({ clientsCreated: 0, modelCalls: 0 });

    const last = await route(postTo("decompose", { taskId: "t7" }));
    expect(last.status).toBe(200);
    await drain(last);
    const callsBefore = { clientsCreated, modelCalls };
    const exhausted = await route(postTo("decompose", { taskId: "t7" }));
    expect(exhausted.status).toBe(429);
    expect(await exhausted.json()).toMatchObject({ error: { code: "AGENT_QUOTA_EXHAUSTED" } });
    expect({ clientsCreated, modelCalls }).toEqual(callsBefore);
    expect(await usage("decompose")).toBe(1);
    expect(await usage("prioritize")).toBe(AGENT_RUN_QUOTA - 1);
  });

  it("DEV-017 AC-5: завислe сховище → 503 після межі очікування; пізній запис резервування не повертається", async () => {
    const gate = Promise.withResolvers<void>();
    const reached = Promise.withResolvers<void>();
    const execute = connection.client.execute.bind(connection.client);
    vi.spyOn(connection.client, "execute").mockImplementationOnce(async (statement, args) => {
      const result = await execute(statement, args);
      reached.resolve();
      await gate.promise;
      return result;
    });
    const hung = createAgentRoute(echoAgent, deps({ quotaTimeoutMs: 20 }));
    const pending = hung(post({ input: { focus: null } }));
    await reached.promise;
    const response = await pending;
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "AGENT_QUOTA_UNAVAILABLE" } });
    expect({ clientsCreated, modelCalls }).toEqual({ clientsCreated: 0, modelCalls: 0 });

    gate.resolve();
    await vi.waitFor(async () => expect(await usage("prioritize")).toBe(1));
    expect(clientsCreated).toBe(0);

    const never = await createAgentRoute(echoAgent, deps({ quotaTimeoutMs: 20, getDb: () => new Promise(() => undefined) }))(post({ input: { focus: null } }));
    expect(never.status).toBe(503);
  });
});
