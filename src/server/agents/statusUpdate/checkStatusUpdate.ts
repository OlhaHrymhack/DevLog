import type { StatusUpdate, StatusUpdateInput } from "@/entities/agentRun";
import { STATUS_UPDATE_SHORT_MAX } from "@/entities/agentRun";
import type { AgentContext } from "../core/types";

const REFERENCE = /\bPR\s*#\d+|#\d+|https?:\/\/[^\s)>|]+|\bwww\.[^\s)>|]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|io|dev|app|ua|ru)\b(?:\/[^\s)>|]*)?/gi;
const BROADCAST = /@(?:channel|here|everyone)\b|<!(?:channel|here|everyone)|<@[A-Z0-9]+>|<mailto:/i;
const EMOJI = /\p{Extended_Pictographic}/gu;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

export const STATUS_UPDATE_FACT_MESSAGES = { broadcast: "У тексті є масова згадка або службова Slack-розмітка" } as const;

/** Посилання у канонічному вигляді: нижній регістр, без пробілів у `PR #n`, без пунктуації в кінці. */
const canonical = (reference: string): string => reference.toLowerCase().replace(/\s+/g, "").replace(TRAILING_PUNCTUATION, "");
const referencesOf = (text: string): string[] => (text.match(REFERENCE) ?? []).map(canonical);

/**
 * Перевірка фактів: задача існує; `mentions` — лише її підзадачі й нотатки; кожне посилання (`PR #n`, `#n`, URL, домен) є в назві, описі,
 * підзадачах чи нотатках (точний збіг); без масових згадок Slack; емодзі лише з даних задачі для `manager`; `short` ≤ 200; `thin` відповідає даним.
 * Тон `short` завжди допустимий: це тон шаблонного fallback.
 */
export const checkStatusUpdate = (result: StatusUpdate, ctx: AgentContext, input: StatusUpdateInput): string[] => {
  const task = ctx.tasks.getTask(input.taskId);
  if (!task) return [`taskId ${input.taskId}: задачі не існує`];
  const violations: string[] = [];
  const subtaskIds = new Set(task.subtasks.map((subtask) => subtask.id));
  const noteIds = new Set(task.notes.map((note) => note.id));
  result.mentions.subtaskIds.filter((id) => !subtaskIds.has(id))
    .forEach((id) => violations.push(`mentions.subtaskIds: підзадачі ${id} немає в цій задачі`));
  result.mentions.noteIds.filter((id) => !noteIds.has(id))
    .forEach((id) => violations.push(`mentions.noteIds: нотатки ${id} немає в цій задачі`));

  const corpus = [task.title, task.description, ...task.subtasks.map((subtask) => subtask.title), ...task.notes.map((note) => note.text)].join("\n");
  const known = new Set(referencesOf(corpus));
  const unknown = new Map((result.text.match(REFERENCE) ?? []).filter((raw) => !known.has(canonical(raw))).map((raw) => [canonical(raw), raw.replace(TRAILING_PUNCTUATION, "")]));
  unknown.forEach((raw) => violations.push(`У тексті згадано ${raw}, якого немає в нотатках`));
  if (BROADCAST.test(result.text)) violations.push(STATUS_UPDATE_FACT_MESSAGES.broadcast);

  if (input.tone !== "auto" && result.tone !== "short" && result.tone !== input.tone) {
    violations.push(`Тон має бути «${input.tone}», а не «${result.tone}»`);
  }
  if (input.serious && result.tone === "humor") violations.push("Тон «humor» недоступний у серйозному режимі");
  if (result.tone === "manager") {
    const own = new Set(corpus.match(EMOJI) ?? []);
    if ((result.text.match(EMOJI) ?? []).some((emoji) => !own.has(emoji))) violations.push("Для менеджера без емодзі");
  }
  if (result.tone === "short" && result.text.length > STATUS_UPDATE_SHORT_MAX) {
    violations.push(`Короткий апдейт не довший за ${STATUS_UPDATE_SHORT_MAX} символів`);
  }
  const thin = task.subtasks.length === 0 && task.notes.length === 0;
  if (result.thin !== thin) violations.push(`thin має бути ${thin}`);
  return violations;
};
