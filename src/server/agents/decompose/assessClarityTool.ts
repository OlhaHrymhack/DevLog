import "server-only";
import { z } from "zod";
import { clarityReasons } from "@/entities/task";
import { NotFoundError } from "@/shared/api/errors";
import { defineTool } from "../core/tools";

export const ASSESS_CLARITY_TOOL = "assess_clarity";

/** Лише читання: підказка про нечіткість задачі за правилами `isVague`. Рішення приймає модель. */
export const assessClarityTool = defineTool({
  name: ASSESS_CLARITY_TOOL,
  label: "Оцінити чіткість формулювання",
  description: "Повертає { vague, reasons } для задачі за id: підказка, чи опис занадто короткий або розмитий. Лише читання.",
  inputSchema: z.object({ id: z.string().min(1) }),
  run: ({ id }, ctx) => {
    const task = ctx.tasks.getTask(id);
    if (!task) throw new NotFoundError(`Задачу ${id} не знайдено`);
    const reasons = clarityReasons(task);
    return { vague: reasons.length > 0, reasons };
  },
});
