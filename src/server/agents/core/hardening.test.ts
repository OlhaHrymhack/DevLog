import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import type { AgentEvent } from "@/entities/agentRun";
import { createLogger } from "../../logger";
import { createTaskRepository } from "../../tasks/repository";
import {
  createRecordingClient, createTestDb, echoAgent, fromScript, NOW, VALID_RESULT, type TestDb,
} from "./__tests__/echoAgent";
import { scriptedSubmit, scriptedToolCall, scriptedTurn } from "./modelClient";
import { listTasksTool, MAX_LISTED_DESCRIPTION_CHARS } from "./readTools";
import {
  FALLBACK_REASONS, MAX_TOOL_CALLS_PER_TURN, MAX_TOOL_OUTPUT_BYTES, runAgent, type AgentRunRepository, type RunAgentOptions,
} from "./runAgent";
import { defineTool, toToolParameters } from "./tools";
import type { ModelClient, ModelMessage } from "./types";

let db: TestDb;
const lines: string[] = [];
const logger = createLogger({ level: "debug", destination: { write: (line: string) => { lines.push(line); } } });

beforeEach(async () => {
  db = await createTestDb();
  lines.length = 0;
});

afterEach(() => {
  db.connection.close();
});

const run = async (client: ModelClient, overrides: Partial<RunAgentOptions> = {}, def = echoAgent) => {
  const events: AgentEvent[] = [];
  const outcome = await runAgent(def, { focus: null }, {
    client, mode: "demo", signal: new AbortController().signal, onEvent: (event) => events.push(event),
    context: db.context, runs: db.runs, logger, ...overrides,
  });
  const [record] = await db.listRuns();
  const steps = record ? await db.runs.listRunSteps(record.id) : [];
  return { outcome, events, record, steps };
};

const toolMessages = (messages: readonly ModelMessage[]) =>
  messages.flatMap((message) => message.role === "tool" ? [message] : []);

const finalEvents = (events: AgentEvent[]) =>
  events.filter((event) => ["result", "fallback", "stopped", "error"].includes(event.type));

describe("DEV-008 AC-10: ліміти проти роздування вартості", () => {
  it("DEV-008 AC-10: більше за MAX_TOOL_CALLS_PER_TURN викликів за хід — зайві отримують is_error, кожен виклик має tool_result", async () => {
    const calls = Array.from({ length: 20 }, () => scriptedToolCall("list_tasks", { status: null }));
    const { client, requests } = createRecordingClient(fromScript([scriptedTurn(...calls), scriptedSubmit(VALID_RESULT)]));
    const { outcome, steps } = await run(client);

    const results = toolMessages(requests[1]?.messages ?? []);
    expect(results).toHaveLength(20);
    expect(results.filter((message) => !message.isError)).toHaveLength(MAX_TOOL_CALLS_PER_TURN);
    expect(JSON.parse(results[MAX_TOOL_CALLS_PER_TURN]?.content ?? "{}").error).toContain("Забагато викликів");
    expect(steps.filter((step) => step.type === "tool")).toHaveLength(MAX_TOOL_CALLS_PER_TURN);
    expect(outcome).toEqual({ status: "result", data: VALID_RESULT });
  });

  it("DEV-008 AC-10: завеликий результат tool обрізається з маркером truncated", async () => {
    const bigTool = defineTool({
      name: "get_task", label: "Прочитати задачу", description: "великий результат",
      inputSchema: z.object({ id: z.string() }), run: () => "я".repeat(MAX_TOOL_OUTPUT_BYTES),
    });
    const { client, requests } = createRecordingClient(fromScript([
      scriptedTurn(scriptedToolCall("get_task", { id: "t1" })),
      scriptedSubmit(VALID_RESULT),
    ]));
    await run(client, {}, { ...echoAgent, tools: [bigTool] });

    const [message] = toolMessages(requests[1]?.messages ?? []);
    const content = JSON.parse(message?.content ?? "{}");
    expect(content).toMatchObject({ truncated: true });
    expect(content.originalBytes).toBeGreaterThan(MAX_TOOL_OUTPUT_BYTES);
    expect(Buffer.byteLength(message?.content ?? "", "utf8")).toBeLessThan(MAX_TOOL_OUTPUT_BYTES * 2);
  });

  it("DEV-008 AC-10: list_tasks скорочує довгі описи й повідомляє total/truncated", async () => {
    const tasks = createTaskRepository(db.connection.db);
    await tasks.createTask({ title: "Довга", description: "д".repeat(5000), status: "todo", priority: "low" }, NOW);
    const result = await listTasksTool.execute({ status: null }, await db.refreshContext());
    const parsed = z.object({
      total: z.number(), truncated: z.boolean(), tasks: z.array(z.object({ description: z.string() })),
    }).parse(result);
    expect(parsed.total).toBe(13);
    expect(parsed.truncated).toBe(false);
    expect(Math.max(...parsed.tasks.map((task) => task.description.length))).toBeLessThanOrEqual(MAX_LISTED_DESCRIPTION_CHARS);
  });

  it("DEV-008 AC-10: довге ім'я невідомого tool обрізається в повідомленні, трасі й логах", async () => {
    const longName = "x".repeat(500);
    const { client, requests } = createRecordingClient(fromScript([
      scriptedTurn(scriptedToolCall(longName, {})),
      scriptedSubmit(VALID_RESULT),
    ]));
    const { events, steps } = await run(client);

    const [message] = toolMessages(requests[1]?.messages ?? []);
    expect(message?.content).not.toContain(longName);
    expect(JSON.stringify(steps)).not.toContain(longName);
    expect(lines.join("\n")).not.toContain(longName);
    const detail = events.flatMap((event) => event.type === "step" && event.detail ? [event.detail] : []).join(" ");
    expect(detail).not.toContain("xxxx");
  });

  it("DEV-008 AC-10: внутрішня помилка tool (SQL-фрагмент) не потрапляє моделі й у трасу", async () => {
    const leaky = defineTool({
      name: "get_task", label: "Прочитати задачу", description: "падає",
      inputSchema: z.object({ id: z.string() }),
      run: () => { throw new Error("SQLITE_BUSY: select * from tasks where secret = 'x'"); },
    });
    const { client, requests } = createRecordingClient(fromScript([
      scriptedTurn(scriptedToolCall("get_task", { id: "t1" })),
      scriptedSubmit(VALID_RESULT),
    ]));
    const { steps, outcome } = await run(client, {}, { ...echoAgent, tools: [leaky] });

    const [message] = toolMessages(requests[1]?.messages ?? []);
    expect(message?.isError).toBe(true);
    expect(message?.content).not.toContain("SQLITE");
    expect(JSON.stringify(steps)).not.toContain("select *");
    expect(lines.join("\n")).toContain("Agent tool failed");
    expect(outcome).toEqual({ status: "result", data: VALID_RESULT });
  });
});

describe("DEV-008 AC-6: дедлайн і стійкість до збоїв", () => {
  it("DEV-008 AC-6: дедлайн запуску завершує його резервним сценарієм з окремою причиною", async () => {
    const hanging: ModelClient = { provider: "scripted", create: () => new Promise(() => undefined) };
    const { outcome, events, record } = await run(hanging, { deadlineMs: 30 });

    expect(outcome).toMatchObject({ status: "fallback", reason: FALLBACK_REASONS.deadline });
    expect(record?.status).toBe("fallback");
    expect(finalEvents(events)).toHaveLength(1);
  });

  it("DEV-008 AC-6: ручна зупинка лишається stopped, а не дедлайном", async () => {
    const hanging: ModelClient = { provider: "scripted", create: () => new Promise(() => undefined) };
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10);
    const { outcome, record } = await run(hanging, { signal: controller.signal, deadlineMs: 5000 });

    expect(outcome).toEqual({ status: "stopped" });
    expect(record?.status).toBe("stopped");
  });

  it("DEV-008 AC-9: збій finishRun не кидає з runAgent: одна фінальна подія і запис у лозі", async () => {
    const failingRuns: AgentRunRepository = { ...db.runs, finishRun: async () => { throw new Error("SQLITE_BUSY"); } };
    const { client } = createRecordingClient(fromScript([scriptedSubmit(VALID_RESULT)]));
    const { outcome, events } = await run(client, { runs: failingRuns });

    expect(outcome).toEqual({ status: "result", data: VALID_RESULT });
    expect(finalEvents(events)).toHaveLength(1);
    expect(lines.join("\n")).toContain("Agent run could not be finalized");
  });

  it("DEV-008 AC-9: збій createRun → фінальна подія error без винятку", async () => {
    const failingRuns: AgentRunRepository = { ...db.runs, createRun: async () => { throw new Error("SQLITE_BUSY"); } };
    const { client } = createRecordingClient(fromScript([scriptedSubmit(VALID_RESULT)]));
    const { outcome, events } = await run(client, { runs: failingRuns });

    expect(outcome).toMatchObject({ status: "error", error: { code: "AGENT_ERROR" } });
    expect(events.map((event) => event.type)).toEqual(["error"]);
    expect(lines.join("\n")).toContain("Agent run could not be created");
  });
});

describe("DEV-008 AC-4/AC-8: повтор і fault injection", () => {
  it("DEV-008 AC-4: після відхилення і проміжного tool-ходу прогрес повертається до робочого кроку", async () => {
    const { client } = createRecordingClient(fromScript([
      scriptedTurn(scriptedToolCall("list_tasks", { status: null })),
      scriptedSubmit({ taskId: "missing", summary: "x" }),
      scriptedTurn(scriptedToolCall("get_task", { id: "t1" })),
      scriptedSubmit(VALID_RESULT),
    ]));
    const { events, outcome } = await run(client);

    expect(outcome).toEqual({ status: "result", data: VALID_RESULT });
    const afterRetry = events.filter((event) => event.type === "step" && event.detail === "Прочитати задачу");
    expect(afterRetry.length).toBeGreaterThan(0);
  });

  it("DEV-008 AC-8: підмінені fault injection відповіді позначені injected у трасі", async () => {
    const { client } = createRecordingClient(fromScript([scriptedSubmit(VALID_RESULT)]));
    const { steps, outcome } = await run(client, { forceInvalidOutput: true });

    expect(outcome).toMatchObject({ status: "fallback", reason: FALLBACK_REASONS.invalidResult });
    const modelSteps = steps.filter((step) => step.type === "model");
    expect(modelSteps.length).toBeGreaterThan(0);
    expect(modelSteps.every((step) => z.object({ injected: z.literal(true) }).safeParse(step.payload).success)).toBe(true);
  });
});

describe("DEV-008 AC-7/AC-10: strict-сумісність схем tools", () => {
  const rejects = (schema: z.ZodType, pattern: RegExp) => expect(() => toToolParameters(schema)).toThrow(pattern);

  it("відхиляє непідтримувані ключові слова OpenAI strict-режиму", () => {
    rejects(z.object({ v: z.intersection(z.string().min(1), z.string().max(5)) }), /allOf/);
    rejects(z.object({ map: z.record(z.string(), z.string()) }), /propertyNames/);
    rejects(z.object({ pair: z.tuple([z.string(), z.number()]) }), /tuple|prefixItems/);
  });

  it("корінь схеми має бути об'єктом", () => {
    rejects(z.string(), /root type: object/);
    rejects(z.array(z.string()), /root type: object/);
  });

  it("minLength, nullable й поля з іменами-ключовими словами проходять", () => {
    const parameters = toToolParameters(z.object({ not: z.string().min(1), items: z.array(z.string()), note: z.string().nullable() }));
    expect(parameters).toMatchObject({ type: "object", additionalProperties: false });
  });
});
