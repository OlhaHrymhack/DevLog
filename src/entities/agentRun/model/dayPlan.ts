import { z } from "zod";

export const DAY_PLAN_MAX_ITEMS = 3;
export const DAY_PLAN_MAX_DEFERRED = 3;
export const DAY_PLAN_WHY = { min: 20, max: 300 } as const;
export const DAY_PLAN_REASON_MAX = 200;
export const DAY_PLAN_JOKE_MAX = 200;

/**
 * Результат агента A. Strict-сумісний для OpenAI: усі поля required, `joke` — nullable замість optional.
 * Для fallback-плану (без AI) `why` містить фіксований рядок правила, а UI його не показує.
 */
export const DayPlanSchema = z.object({
  items: z.array(z.object({
    taskId: z.string().min(1),
    why: z.string().min(DAY_PLAN_WHY.min).max(DAY_PLAN_WHY.max),
    joke: z.string().max(DAY_PLAN_JOKE_MAX).nullable(),
  })).min(1).max(DAY_PLAN_MAX_ITEMS),
  deferred: z.array(z.object({
    taskId: z.string().min(1),
    reason: z.string().min(1).max(DAY_PLAN_REASON_MAX),
  })).max(DAY_PLAN_MAX_DEFERRED),
});

export type DayPlan = z.infer<typeof DayPlanSchema>;

export const DayPlanInputSchema = z.strictObject({ serious: z.boolean() });

export type DayPlanInput = z.infer<typeof DayPlanInputSchema>;
