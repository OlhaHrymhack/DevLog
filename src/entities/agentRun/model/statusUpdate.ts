import { z } from "zod";

export const STATUS_UPDATE_TONES = ["team", "manager", "short", "humor"] as const;
export const STATUS_UPDATE_REQUESTED_TONES = ["auto", ...STATUS_UPDATE_TONES] as const;
export const STATUS_UPDATE_TEXT = { min: 20, max: 800 } as const;
export const STATUS_UPDATE_SHORT_MAX = 200;
export const STATUS_UPDATE_MENTIONS_MAX = 50;

export const StatusUpdateToneSchema = z.enum(STATUS_UPDATE_TONES);
export const StatusUpdateRequestedToneSchema = z.enum(STATUS_UPDATE_REQUESTED_TONES);

/**
 * Результат агента C. Strict-сумісний для OpenAI: усі поля required, `thin` — boolean.
 * `text` — Slack-розмітка (`*bold*`); `mentions` — id підзадач і нотаток задачі, на які спирається текст.
 */
export const StatusUpdateSchema = z.object({
  tone: StatusUpdateToneSchema,
  text: z.string().min(STATUS_UPDATE_TEXT.min).max(STATUS_UPDATE_TEXT.max),
  mentions: z.object({
    subtaskIds: z.array(z.string().min(1)).max(STATUS_UPDATE_MENTIONS_MAX),
    noteIds: z.array(z.string().min(1)).max(STATUS_UPDATE_MENTIONS_MAX),
  }),
  thin: z.boolean(),
});

export type StatusUpdate = z.infer<typeof StatusUpdateSchema>;
export type StatusUpdateTone = z.infer<typeof StatusUpdateToneSchema>;
export type StatusUpdateRequestedTone = z.infer<typeof StatusUpdateRequestedToneSchema>;

export const StatusUpdateInputSchema = z.strictObject({
  taskId: z.string().min(1).max(100),
  tone: StatusUpdateRequestedToneSchema,
  serious: z.boolean().optional(),
}).refine((input) => !(input.tone === "humor" && input.serious), {
  path: ["tone"],
  message: "Тон «з гумором» недоступний у серйозному режимі",
});

export type StatusUpdateInput = z.infer<typeof StatusUpdateInputSchema>;
