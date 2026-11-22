import { NoteCreateInputSchema } from "@/entities/task";

export const NOTE_EMPTY_MESSAGE = "Нотатка порожня";
export const NOTE_TOO_LONG_MESSAGE = "Нотатка задовга: максимум 2000 символів";

export const validateNote = (text: string) => {
  const parsed = NoteCreateInputSchema.safeParse({ text });
  if (parsed.success) return { ok: true, text: parsed.data.text } as const;
  return { ok: false, message: text.trim() ? NOTE_TOO_LONG_MESSAGE : NOTE_EMPTY_MESSAGE } as const;
};
