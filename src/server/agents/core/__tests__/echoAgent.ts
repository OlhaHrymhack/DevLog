import { z } from "zod";
import { createDb } from "../../../db/client";
import { seedDatabase } from "../../../db/seed";
import { createAgentRunRepository } from "../../../agentRuns/repository";
import { agentRuns } from "../../../agentRuns/schema";
import { createAgentContext, READ_TOOLS } from "../readTools";
import { scriptedSubmit, scriptedToolCall, scriptedTurn } from "../modelClient";
import type { AgentDefinition, ModelClient, ModelRequest, ModelResponse } from "../types";

/** Тестовий агент: читає задачі й повертає id однієї з коротким підсумком. Живе лише в тестах. */
export const SYSTEM_PROMPT_MARKER = "ECHO-SYSTEM-PROMPT-7d1e";
export const NOW = new Date("2026-11-21T12:00:00Z");

export const EchoResultSchema = z.object({ taskId: z.string().min(1), summary: z.string().min(1) });
export const EchoInputSchema = z.object({ focus: z.string().nullable() });

export const echoAgent: AgentDefinition<typeof EchoInputSchema, typeof EchoResultSchema> = {
  kind: "prioritize",
  systemPrompt: `${SYSTEM_PROMPT_MARKER}: обери одну задачу і коротко поясни чому.`,
  inputSchema: EchoInputSchema,
  buildUserMessage: ({ focus }) => `Обери задачу${focus ? ` з фокусом «${focus}»` : ""}.`,
  tools: READ_TOOLS,
  resultSchema: EchoResultSchema,
  factCheck: ({ taskId }, ctx) => ctx.tasks.getTask(taskId) ? [] : [`taskId: задачі ${taskId} не існує`],
  fallback: (_input, ctx) => ({ taskId: ctx.tasks.listTasks()[0]?.id ?? "t1", summary: "Базове правило: найновіша задача" }),
  mockScript: () => [
    scriptedTurn(scriptedToolCall("list_tasks", { status: null })),
    scriptedTurn(scriptedToolCall("get_task", { id: "t1" })),
    scriptedSubmit({ taskId: "t1", summary: "Мок: t1 найгарячіша" }),
  ],
  invalidResult: () => ({ taskId: "missing-task", summary: "Хибний кейс" }),
  stepLabels: ["Зібрати задачі", "Прочитати задачу", "Перевірити результат"],
};

export const VALID_RESULT = { taskId: "t1", summary: "t1 горить" };

export const createTestDb = () => {
  const connection = createDb(":memory:");
  seedDatabase(connection.db, NOW);
  const runs = createAgentRunRepository(connection.db);
  const context = createAgentContext(connection.db, NOW);
  const listRuns = () => connection.db.select().from(agentRuns).all();
  return { connection, runs, context, listRuns };
};

type Responder = (request: ModelRequest, call: number) => ModelResponse | Promise<ModelResponse>;

/** Клієнт, що записує кожен запит (копію історії) і відповідає функцією. */
export const createRecordingClient = (responder: Responder) => {
  const requests: ModelRequest[] = [];
  const client: ModelClient = {
    provider: "scripted",
    create: async (request) => {
      requests.push({ ...request, messages: [...request.messages] });
      return responder(request, requests.length);
    },
  };
  return { client, requests };
};

export const fromScript = (turns: readonly ModelResponse[]): Responder => (_request, call) =>
  turns[call - 1] ?? { stop: "end", toolCalls: [], text: "" };
