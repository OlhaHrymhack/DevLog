import "server-only";
import { z } from "zod";
import { READ_TOOLS } from "../core/readTools";
import type { AgentDefinition } from "../core/types";

export const SmokeInputSchema = z.strictObject({});

export const SmokeResultSchema = z.object({
  taskId: z.string().min(1),
  summary: z.string().min(1),
});

/**
 * Мінімальний агент для перевірки live-інтеграції: читає задачі й повертає id однієї з коротким поясненням.
 * Використовується лише dev-only маршрутом smoke; предметних правил агентів A–D тут немає.
 */
export const smokeAgent: AgentDefinition<typeof SmokeInputSchema, typeof SmokeResultSchema> = {
  kind: "prioritize",
  systemPrompt: "Це технічна перевірка зв'язку. Прочитай список задач інструментом list_tasks, обери одну задачу і поверни її id та одне коротке речення.",
  inputSchema: SmokeInputSchema,
  buildUserMessage: () => "Обери одну задачу зі списку.",
  tools: READ_TOOLS,
  resultSchema: SmokeResultSchema,
  factCheck: ({ taskId }, ctx) => ctx.tasks.getTask(taskId) ? [] : [`taskId: задачі ${taskId} не існує`],
  fallback: (_input, ctx) => ({ taskId: ctx.tasks.listTasks()[0]?.id ?? "unknown", summary: "Базове правило: перша задача зі списку" }),
  mockScript: () => [],
  invalidResult: () => ({ taskId: "missing-task", summary: "Хибний кейс" }),
  stepLabels: ["Прочитати задачі", "Прочитати задачу", "Перевірити результат"],
};
