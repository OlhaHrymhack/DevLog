import { z } from "zod";

export const DECOMPOSITION_ITEMS = { min: 3, max: 6 } as const;
export const DECOMPOSITION_QUESTIONS = { min: 1, max: 3 } as const;
export const DECOMPOSITION_TITLE = { min: 3, max: 120 } as const;
export const DECOMPOSITION_RATIONALE = { min: 3, max: 160 } as const;
export const DECOMPOSITION_QUESTION_MAX = 300;
export const DECOMPOSITION_ESTIMATE_MAX = 50;
export const CLARIFICATION = { min: 3, max: 1000 } as const;

const DecompositionItemSchema = z.object({
  title: z.string().trim().min(DECOMPOSITION_TITLE.min).max(DECOMPOSITION_TITLE.max),
  estimate: z.string().trim().min(1).max(DECOMPOSITION_ESTIMATE_MAX),
  rationale: z.string().trim().min(DECOMPOSITION_RATIONALE.min).max(DECOMPOSITION_RATIONALE.max),
});

/**
 * Результат агента B. Strict-режим OpenAI ненадійно приймає union, тому форма плоска: `kind` вибирає гілку,
 * а друга гілка — порожній масив. `superRefine` зводить це до union зі специфікації:
 * `clarify` — 1–3 питання без пунктів, `subtasks` — 3–6 пунктів без питань.
 */
export const DecompositionSchema = z.object({
  kind: z.enum(["clarify", "subtasks"]),
  questions: z.array(z.string().trim().min(3).max(DECOMPOSITION_QUESTION_MAX)).max(DECOMPOSITION_QUESTIONS.max),
  items: z.array(DecompositionItemSchema).max(DECOMPOSITION_ITEMS.max),
}).superRefine((value, ctx) => {
  if (value.kind === "clarify") {
    if (value.questions.length < DECOMPOSITION_QUESTIONS.min) {
      ctx.addIssue({ code: "custom", path: ["questions"], message: `Потрібно ${DECOMPOSITION_QUESTIONS.min}–${DECOMPOSITION_QUESTIONS.max} питання` });
    }
    if (value.items.length > 0) ctx.addIssue({ code: "custom", path: ["items"], message: "Уточнення не містить підзадач" });
    return;
  }
  if (value.items.length < DECOMPOSITION_ITEMS.min) {
    ctx.addIssue({ code: "custom", path: ["items"], message: `Потрібно ${DECOMPOSITION_ITEMS.min}–${DECOMPOSITION_ITEMS.max} підзадач` });
  }
  if (value.questions.length > 0) ctx.addIssue({ code: "custom", path: ["questions"], message: "Підзадачі не містять питань" });
});

export type Decomposition = z.infer<typeof DecompositionSchema>;
export type DecompositionItem = Decomposition["items"][number];

export const DecomposeInputSchema = z.strictObject({
  taskId: z.string().min(1),
  clarification: z.string().trim().min(CLARIFICATION.min).max(CLARIFICATION.max).optional(),
  serious: z.boolean().optional(),
});

export type DecomposeInput = z.infer<typeof DecomposeInputSchema>;
