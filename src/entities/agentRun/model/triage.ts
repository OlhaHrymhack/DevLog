import { z } from "zod";

export const STUCK_CAUSES = ["waiting-review", "vague", "too-big", "no-activity"] as const;
export const STUCK_ACTIONS = ["draft-review", "split", "draft-help", "open"] as const;
export const STUCK_MIN_DAYS = 3;
export const STUCK_MAX_ITEMS = 20;
export const STUCK_DRAFT = { min: 20, max: 500 } as const;

export const StuckCauseSchema = z.enum(STUCK_CAUSES);
export const StuckActionSchema = z.enum(STUCK_ACTIONS);

export const STUCK_CAUSE_LABELS: Record<StuckCause, string> = {
  "waiting-review": "Чекає на ревʼю",
  vague: "Задача розмита",
  "too-big": "Задача завелика",
  "no-activity": "Немає активності",
};

export const STUCK_ACTION_LABELS: Record<StuckAction, string> = {
  "draft-review": "Чернетка запиту на ревʼю",
  split: "Розбити на підзадачі",
  "draft-help": "Чернетка прохання про допомогу",
  open: "Відкрити задачу",
};

/** Дія, що відповідає причині (перевіряє factCheck). */
export const STUCK_ACTION_FOR_CAUSE: Record<StuckCause, StuckAction> = {
  "waiting-review": "draft-review",
  vague: "split",
  "too-big": "draft-help",
  "no-activity": "open",
};

/** Результат агента D. Strict-сумісний для OpenAI: усі поля required, `draft` — nullable (лише для `draft-*`). */
export const TriageSchema = z.object({
  items: z.array(z.object({
    taskId: z.string().min(1),
    cause: StuckCauseSchema,
    why: z.string().min(1).max(300),
    action: StuckActionSchema,
    draft: z.string().max(STUCK_DRAFT.max).nullable(),
  })).max(STUCK_MAX_ITEMS),
});

export const StuckRadarInputSchema = z.strictObject({
  snoozedIds: z.array(z.string().min(1).max(100)).max(100),
  serious: z.boolean().optional(),
});

export type StuckCause = z.infer<typeof StuckCauseSchema>;
export type StuckAction = z.infer<typeof StuckActionSchema>;
export type Triage = z.infer<typeof TriageSchema>;
export type TriageItem = Triage["items"][number];
export type StuckRadarInput = z.infer<typeof StuckRadarInputSchema>;
