import "server-only";
import { z } from "zod";
import { NotFoundError } from "@/shared/api/errors";
import { defineTool } from "../core/tools";
import { autoTone } from "./tone";

export const SUGGEST_TONE_TOOL = "suggest_tone";

/** Лише читання: підказка тону за контекстом задачі. Рішення приймає модель. */
export const suggestToneTool = defineTool({
  name: SUGGEST_TONE_TOOL,
  label: "Визначити контекст і тон",
  description: "Повертає { tone, reason }: team, якщо задачу закрито чи прогрес звичайний; manager, якщо є ризик або дедлайн. Лише читання.",
  inputSchema: z.object({ id: z.string().min(1) }),
  run: ({ id }, ctx) => {
    const task = ctx.tasks.getTask(id);
    if (!task) throw new NotFoundError(`Задачу ${id} не знайдено`);
    return autoTone(task, ctx.now);
  },
});
