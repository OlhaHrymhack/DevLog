import "server-only";
import { DAY_PLAN_MAX_DEFERRED, DAY_PLAN_MAX_ITEMS, DayPlanInputSchema, DayPlanSchema, type DayPlan, type DayPlanInput } from "@/entities/agentRun";
import { getTaskTool } from "../core/readTools";
import { scriptedSubmit, scriptedToolCall, scriptedTurn } from "../core/modelClient";
import type { AgentContext, AgentDefinition } from "../core/types";
import { rankActiveTasks, toActiveTaskView } from "./activeTasks";
import { deferredReason, explainTask, FACTOR_PATTERN, jokeFor } from "./explain";
import { LIST_ACTIVE_TASKS_TOOL, listActiveTasksTool } from "./listActiveTasksTool";
import { rulePlan } from "./rulePlan";
import { isUrgent } from "./scoreTask";

/** Недіючий id для fault injection («хибний кейс»): задачі з таким id немає. */
export const INVALID_TASK_ID = "42";

const SYSTEM_PROMPT = [
  "Ти — агент «План на день» трекера задач. Допоможи обрати, з чого почати день.",
  "Прочитай активні задачі інструментом list_active_tasks (за потреби get_task), зваж пріоритет, вік, дні без змін, статус і дедлайни.",
  `Поверни через submit_result: items — від 1 до ${DAY_PLAN_MAX_ITEMS} задач у порядку виконання, кожна з taskId і коротким поясненням why українською (20–300 символів), що спирається на реальні дані (пріоритет, вік, дні без змін, статус, дедлайн);`,
  `deferred — до ${DAY_PLAN_MAX_DEFERRED} задач, які свідомо відкладено, з причиною. Задача не може бути одночасно в items і в deferred.`,
  "Задачу з дедлайном менш ніж за 48 годин (urgent = true) обов'язково включи в items. Використовуй лише id із результатів інструментів, нічого не вигадуй.",
].join("\n");

const missingTask = (taskId: string, ctx: AgentContext): string | null => {
  const task = ctx.tasks.getTask(taskId);
  if (task === null) return `taskId ${taskId}: задачі не існує`;
  return task.status === "done" ? `taskId ${taskId}: задача вже виконана` : null;
};

/** Перевірка фактів: існування, не-done, дублікати, обов'язкові термінові задачі та згадка фактора в поясненні. */
export const checkDayPlan = (plan: DayPlan, ctx: AgentContext): string[] => {
  const violations: string[] = [];
  const ids = [...plan.items.map((item) => item.taskId), ...plan.deferred.map((entry) => entry.taskId)];
  for (const id of new Set(ids)) {
    const problem = missingTask(id, ctx);
    if (problem) violations.push(problem);
  }
  ids.filter((id, index) => ids.indexOf(id) !== index)
    .forEach((id) => violations.push(`taskId ${id}: повторюється в плані (items і deferred не перетинаються)`));

  const urgentIds = ctx.tasks.listTasks().filter((task) => task.status !== "done" && isUrgent(task, ctx.now)).map((task) => task.id);
  const itemIds = plan.items.map((item) => item.taskId);
  const bumped = urgentIds.filter((id) => !itemIds.includes(id));
  if (bumped.length > 0 && (itemIds.length < DAY_PLAN_MAX_ITEMS || itemIds.some((id) => !urgentIds.includes(id)))) {
    violations.push(`Задачі з дедлайном менш ніж за 48 годин мають бути в items: ${bumped.join(", ")}`);
  }
  plan.items.filter((item) => !FACTOR_PATTERN.test(item.why))
    .forEach((item) => violations.push(`taskId ${item.taskId}: why має спиратися на фактор (пріоритет, вік, дні без змін, статус, дедлайн)`));
  return violations;
};

const buildMockPlan = (input: DayPlanInput, ctx: AgentContext): DayPlan => {
  const byScore = rankActiveTasks(ctx.tasks.listTasks(), ctx.now).map((task) => toActiveTaskView(task, ctx.now));
  const ranked = [...byScore.filter((view) => view.urgent), ...byScore.filter((view) => !view.urgent)];
  return {
    items: ranked.slice(0, DAY_PLAN_MAX_ITEMS).map((view) => ({
      taskId: view.id, why: explainTask(view), joke: input.serious ? null : jokeFor(view),
    })),
    deferred: ranked.slice(DAY_PLAN_MAX_ITEMS).filter((view) => view.priority !== "high").slice(0, 2)
      .map((view) => ({ taskId: view.id, reason: deferredReason(view) })),
  };
};

export const prioritizeAgent: AgentDefinition<typeof DayPlanInputSchema, typeof DayPlanSchema> = {
  kind: "prioritize",
  systemPrompt: SYSTEM_PROMPT,
  inputSchema: DayPlanInputSchema,
  buildUserMessage: ({ serious }) => serious
    ? "Склади план на день. Серйозний режим: поле joke завжди null, без емодзі."
    : "Склади план на день. Поле joke — короткий жарт для гарячих задач або null.",
  tools: [listActiveTasksTool, getTaskTool],
  resultSchema: DayPlanSchema,
  factCheck: checkDayPlan,
  fallback: (_input, ctx) => rulePlan(ctx.tasks.listTasks(), ctx.now),
  mockScript: (input, ctx) => [
    scriptedTurn(scriptedToolCall(LIST_ACTIVE_TASKS_TOOL, { limit: null })),
    scriptedSubmit(buildMockPlan(input, ctx)),
  ],
  invalidResult: () => ({
    items: [{ taskId: INVALID_TASK_ID, why: "Високий пріоритет і дедлайн менш ніж за добу.", joke: null }],
    deferred: [],
  }),
  stepLabels: [
    "Зібрати активні задачі",
    "Зважити пріоритет, вік, статус і дедлайни",
    "Скласти порядок і пояснення",
    "Перевірити відповідь (схема, існування задач)",
  ],
};
