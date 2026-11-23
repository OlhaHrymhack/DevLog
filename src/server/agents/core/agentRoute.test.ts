import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentEventSchema, type AgentEvent } from "@/entities/agentRun";
import { readNdjson } from "@/shared/lib/readNdjson";
import { createAgentRunRepository } from "../../agentRuns/repository";
import { agentRuns } from "../../agentRuns/schema";
import { createDb, type DbConnection } from "../../db/client";
import { seedDatabase } from "../../db/seed";
import { createLogger, logger } from "../../logger";
import { echoAgent, NOW } from "./__tests__/echoAgent";
import { createAgentRoute, type AgentRouteDeps } from "./agentRoute";
import { createScriptedClient, scriptedSubmit } from "./modelClient";
import { FALLBACK_REASONS } from "./runAgent";
import type { ModelClient } from "./types";

const DEMO_ENV = { aiMode: "demo", OPENAI_API_KEY: undefined, OPENAI_MODEL: "test" } as const;
const silent = createLogger({ level: "silent", destination: { write: () => undefined } });

let directory: string;
let connection: DbConnection;

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "devlog-agent-route-"));
  connection = await createDb(`file:${join(directory, "agents.db")}`);
  await seedDatabase(connection.db, NOW);
  vi.spyOn(logger, "info").mockImplementation(() => undefined);
  vi.spyOn(logger, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  connection.close();
  rmSync(directory, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const deps = (overrides: Partial<AgentRouteDeps> = {}): AgentRouteDeps => ({
  getDb: () => connection.db,
  getEnv: () => DEMO_ENV,
  createClient: (_env, script) => createScriptedClient(script()),
  now: () => NOW,
  logger: silent,
  ...overrides,
});

const post = (body: unknown, signal?: AbortSignal) => new Request("http://localhost/api/agents/prioritize", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal,
});

const readEvents = async (response: Response): Promise<AgentEvent[]> => {
  const events: AgentEvent[] = [];
  if (!response.body) throw new Error("no body");
  await readNdjson(response.body, (value) => events.push(AgentEventSchema.parse(value)));
  return events;
};

const listRuns = () => connection.db.select().from(agentRuns).all();
const FINAL = ["result", "fallback", "stopped", "error"];

describe("POST агента → NDJSON", () => {
  it("DEV-008 AC-9 AC-1: demo-запуск стрімить валідні події run → step… → result і пише трасу в SQLite", async () => {
    const response = await createAgentRoute(echoAgent, deps())(post({ input: { focus: null } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");

    const events = await readEvents(response);
    expect(events[0]).toMatchObject({ type: "run", mode: "demo" });
    expect(events.slice(1, -1).every((event) => event.type === "step")).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: "result", status: "result", data: { taskId: "t1" } });
    expect(events.filter((event) => FINAL.includes(event.type))).toHaveLength(1);

    const [record] = await listRuns();
    expect(record).toMatchObject({ kind: "prioritize", mode: "demo", status: "result" });
    const steps = await createAgentRunRepository(connection.db).listRunSteps(record?.id ?? "");
    expect(steps.map((step) => step.type)).toEqual(["model", "tool", "model", "tool", "model", "validation"]);
  });

  it("DEV-008 AC-9: перша подія приходить до завершення моделі (без буферизації)", async () => {
    const gate = Promise.withResolvers<void>();
    const client: ModelClient = {
      provider: "scripted",
      create: async () => {
        await gate.promise;
        return scriptedSubmit({ taskId: "t1", summary: "ok" });
      },
    };
    const response = await createAgentRoute(echoAgent, deps({ createClient: () => client }))(post({ input: { focus: null } }));
    const reader = response.body?.getReader();
    const first = await reader?.read();
    const text = new TextDecoder().decode(first?.value);
    expect(AgentEventSchema.parse(JSON.parse(text.split("\n")[0] ?? "")).type).toBe("run");
    expect((await listRuns())[0]?.status).toBe("running");

    gate.resolve();
    let rest = "";
    for (let chunk = await reader?.read(); chunk && !chunk.done; chunk = await reader?.read()) rest += new TextDecoder().decode(chunk.value);
    expect(rest.trim().split("\n").map((line) => AgentEventSchema.parse(JSON.parse(line)).type).at(-1)).toBe("result");
  });

  it("DEV-008 AC-9: невалідне тіло → 400 JSON-помилка до відкриття стріму, запуск не створено", async () => {
    const route = createAgentRoute(echoAgent, deps());
    for (const body of [{}, { input: { focus: 5 } }, { input: { focus: null }, extra: true }]) {
      const response = await route(post(body));
      expect(response.status).toBe(400);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(await response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    }
    expect(await listRuns()).toEqual([]);
  });

  it("DEV-008 AC-6: скасування запиту → stopped у БД і остання подія stopped", async () => {
    const controller = new AbortController();
    const started = Promise.withResolvers<void>();
    const client: ModelClient = {
      provider: "scripted",
      create: ({ signal }) => new Promise((_resolve, reject) => {
        started.resolve();
        signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
    };
    const response = await createAgentRoute(echoAgent, deps({ createClient: () => client }))(post({ input: { focus: null } }, controller.signal));
    const eventsPromise = readEvents(response);
    await started.promise;
    controller.abort();
    const events = await eventsPromise;

    expect(events.at(-1)).toEqual({ type: "stopped" });
    expect(events.filter((event) => FINAL.includes(event.type))).toHaveLength(1);
    expect((await listRuns())[0]?.status).toBe("stopped");
  });
});

describe("POST агента: fault injection", () => {
  it("DEV-008 AC-8: у production поле debug.forceInvalidOutput → 400", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await createAgentRoute(echoAgent, deps())(post({ input: { focus: null }, debug: { forceInvalidOutput: true } }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(await listRuns()).toEqual([]);
  });

  it("DEV-008 AC-8: у dev debug.forceInvalidOutput → fallback після двох відхилень", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const response = await createAgentRoute(echoAgent, deps())(post({ input: { focus: null }, debug: { forceInvalidOutput: true } }));
    const events = await readEvents(response);
    expect(events.at(-1)).toMatchObject({ type: "fallback", reason: FALLBACK_REASONS.invalidResult });
    const steps = await createAgentRunRepository(connection.db).listRunSteps((await listRuns())[0]?.id ?? "");
    expect(steps.filter((step) => step.type === "validation").map((step) => step.state)).toEqual(["fail", "fail"]);
  });

  it("DEV-008 AC-8: у production звичайний запит без debug працює", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const events = await readEvents(await createAgentRoute(echoAgent, deps())(post({ input: { focus: null } })));
    expect(events.at(-1)).toMatchObject({ type: "result" });
  });
});
