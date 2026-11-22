import type { z } from "zod";
import type { AgentRunKind } from "@/entities/agentRun";
import type { Task, TaskListItem, TaskListQuery } from "@/entities/task";

/** Провайдер-незалежний контракт моделі. Адаптери: `ScriptedClient` (demo/тести) і `OpenAIClient` (live). */
export type ToolCall = { id: string; name: string; /** Сирий JSON аргументів, як його повернула модель. */ arguments: string };

export type ModelMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls: ToolCall[] }
  /** `isError` — внутрішня ознака; провайдеру помилка йде як JSON `{ "error": … }` у `content`. */
  | { role: "tool"; toolCallId: string; content: string; isError: boolean };

export type ToolSpec = { name: string; description: string; parameters: Record<string, unknown> };

export type ModelStop = "tool_use" | "end" | "refusal" | "max_tokens";

export type ModelResponse = {
  stop: ModelStop;
  toolCalls: ToolCall[];
  text: string;
  /** Відповідь підмінено fault injection (dev) — не від провайдера; позначається в трасі. */
  injected?: boolean;
};

export type ModelRequest = {
  system: string;
  messages: readonly ModelMessage[];
  tools: readonly ToolSpec[];
  signal: AbortSignal;
};

export type ModelClient = {
  provider: "scripted" | "openai";
  create: (request: ModelRequest) => Promise<ModelResponse>;
};

/** Лише читання: агенти не мають доступу до запису (зміни даних — окремий REST після «Confirm»). */
export type TaskReader = {
  listTasks: (query?: Partial<TaskListQuery>) => TaskListItem[];
  getTask: (id: string) => Task | null;
};

export type AgentContext = { tasks: TaskReader; now: Date };

export type AgentTool = ToolSpec & {
  /** Людська назва для деталі кроку в UI. */
  label: string;
  /** Zod-парс вхідних даних → виконання. Кидає на невалідний input чи помилку виконання. */
  execute: (input: unknown, ctx: AgentContext) => Promise<unknown>;
};

/** Один хід скрипту `ScriptedClient`. */
export type ScriptedTurn = ModelResponse;

export type AgentDefinition<Input extends z.ZodType, Result extends z.ZodType> = {
  kind: AgentRunKind;
  systemPrompt: string;
  inputSchema: Input;
  buildUserMessage: (input: z.infer<Input>) => string;
  tools: readonly AgentTool[];
  /** Схема `submit_result`; сумісна зі strict-режимом tools: усі поля required, замість optional — `nullable`. */
  resultSchema: Result;
  /** Перевірка фактів (напр. що `taskId` існує). Порожній масив — порушень немає. */
  factCheck: (result: z.infer<Result>, ctx: AgentContext) => string[];
  /** Детерміноване правило без AI; проходить ті самі перевірки. */
  fallback: (input: z.infer<Input>, ctx: AgentContext) => z.infer<Result>;
  /** Сценарій demo-режиму. */
  mockScript: (input: z.infer<Input>, ctx: AgentContext) => ScriptedTurn[];
  /** «Хибний кейс» для fault injection: проходить Zod, але не проходить `factCheck` (або схему). */
  invalidResult: (input: z.infer<Input>, ctx: AgentContext) => unknown;
  /** Людські назви кроків для прогресу; останній — перевірка результату. Мінімум 2. Прив'язка до tools евристична (раунд tools = робоча фаза). */
  stepLabels: readonly [string, string, ...string[]];
  /** `clarify`, якщо результат — уточнювальне питання. За замовчуванням `result`. */
  classify?: (result: z.infer<Result>) => "result" | "clarify";
  taskId?: (input: z.infer<Input>) => string | null;
};
