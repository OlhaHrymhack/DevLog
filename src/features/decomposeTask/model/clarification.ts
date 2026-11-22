import { CLARIFICATION } from "@/entities/agentRun";

export const CLARIFICATION_NOTE_PREFIX = "Уточнення для декомпозиції: ";
export const CLARIFICATION_TOO_SHORT = "Напишіть хоча б кілька слів";

export type ClarificationCheck = { ok: true; text: string } | { ok: false; message: string };

export const validateClarification = (raw: string): ClarificationCheck => {
  const text = raw.trim();
  if (text.length < CLARIFICATION.min) return { ok: false, message: CLARIFICATION_TOO_SHORT };
  if (text.length > CLARIFICATION.max) return { ok: false, message: `Не більше ${CLARIFICATION.max} символів` };
  return { ok: true, text };
};

/** Текст нотатки, яку застосунок зберігає перед новим запуском агента. */
export const clarificationNote = (text: string): string => `${CLARIFICATION_NOTE_PREFIX}${text}`;
