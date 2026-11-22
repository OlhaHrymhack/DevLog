import "server-only";
import { z } from "zod";
import { NotFoundError } from "@/shared/api/errors";
import { defineTool } from "../core/tools";
import { diagnose } from "./diagnose";

export const DIAGNOSE_HINT_TOOL = "diagnose_hint";

/** Лише читання: підказка за правилом прототипу (cause, action, why). Рішення приймає модель. */
export const diagnoseHintTool = defineTool({
  name: DIAGNOSE_HINT_TOOL,
  label: "Визначити ймовірну причину",
  description: "Повертає { cause, action, why } за правилом: PR/ревʼю в нотатках → waiting-review; без підзадач і нотаток → vague; ≥ 3 відкритих підзадач → too-big; інакше no-activity. Лише читання.",
  inputSchema: z.object({ id: z.string().min(1) }),
  run: ({ id }, ctx) => {
    const task = ctx.tasks.getTask(id);
    if (!task) throw new NotFoundError(`Задачу ${id} не знайдено`);
    return diagnose(task);
  },
});
