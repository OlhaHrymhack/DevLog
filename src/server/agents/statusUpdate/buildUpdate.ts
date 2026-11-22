import { STATUS_UPDATE_SHORT_MAX, STATUS_UPDATE_TEXT, type StatusUpdate, type StatusUpdateTone } from "@/entities/agentRun";
import { getHeat, STATUS_LABELS, type Task } from "@/entities/task";
import { daysBetween } from "@/shared/lib/daysBetween";
import { plural } from "@/shared/lib/plural";

const MAX_LISTED = 5;
const REVIEW_NOTE = /\bPR\b|ревʼю|рев'ю|\breview\b/i;
const BROADCAST = /@(channel|here|everyone)\b/gi;
const HEAT_RISK_RANK = 2;

const lower = (value: string): string => value.charAt(0).toLowerCase() + value.slice(1);
/** Прибирає масові згадки Slack з даних задачі: апдейт не має пінгувати канал. */
const safe = (text: string): string => text.replace(BROADCAST, "$1").replace(/<[!@]/g, "<");
const cutAtWord = (text: string, max: number): string => {
  if (text.length <= max) return text;
  const head = text.slice(0, max - 1);
  const space = head.lastIndexOf(" ");
  return `${(space > max / 2 ? head.slice(0, space) : head).trimEnd()}…`;
};
/** Обрізає по рядках з кінця (щоб не різати посилання), лише крайній випадок — по слову. */
const clip = (text: string, max: number): string => {
  const lines = text.split("\n");
  while (lines.length > 1 && lines.join("\n").length > max) lines.pop();
  return cutAtWord(lines.join("\n"), max);
};
const dueDate = (dueAt: string): string =>
  new Date(dueAt).toLocaleDateString("uk-UA", { day: "numeric", month: "long", timeZone: "UTC" });

export type BuildOptions = { serious?: boolean };

/** Чернетка для mock і fallback (прототип `buildUpdate`): лише дані задачі, без вигаданих фактів. */
export const buildUpdate = (task: Task, tone: StatusUpdateTone, now: Date, { serious = false }: BuildOptions = {}): StatusUpdate => {
  const done = task.subtasks.filter((subtask) => subtask.status === "done").slice(0, MAX_LISTED);
  const open = task.subtasks.filter((subtask) => subtask.status !== "done").slice(0, MAX_LISTED);
  const note = task.notes.at(-1);
  const heatRank = getHeat(task, now).rank;
  const stale = Math.floor(daysBetween(task.updatedAt, now));
  const status = STATUS_LABELS[task.status].toLowerCase();
  const staleLabel = `${stale} ${plural(stale, "день", "дні", "днів")}`;
  const lines: string[] = [];
  const mentioned = { subtaskIds: new Set<string>(), noteIds: new Set<string>() };
  const mentionDone = () => done.forEach((subtask) => mentioned.subtaskIds.add(subtask.id));
  const mentionOpen = () => open.forEach((subtask) => mentioned.subtaskIds.add(subtask.id));
  const mentionNote = () => { if (note) mentioned.noteIds.add(note.id); };
  const titles = (list: typeof done) => list.map((subtask) => lower(subtask.title)).join(", ");

  if (tone === "short") {
    const base = `*${task.title}*: ${status}, ${task.subtasks.filter((subtask) => subtask.status === "done").length}/${task.subtasks.length} підзадач.`;
    const next = open[0] ? ` Далі: ${lower(open[0].title)}.` : "";
    const fits = base.length + next.length <= STATUS_UPDATE_SHORT_MAX;
    if (fits && open[0]) mentioned.subtaskIds.add(open[0].id);
    lines.push(fits ? base + next : base);
  } else if (tone === "manager") {
    const total = task.subtasks.length;
    const finished = task.subtasks.filter((subtask) => subtask.status === "done").length;
    lines.push(`*${task.title}*`);
    lines.push(`Статус: ${status}${total ? `, прогрес ${finished} з ${total} підзадач.` : "."}`);
    if (open[0]) {
      lines.push(`Наступний крок: ${lower(open[0].title)}.`);
      mentioned.subtaskIds.add(open[0].id);
    }
    if (task.dueAt) lines.push(`Дедлайн: ${dueDate(task.dueAt)}.`);
    const awaitsReview = note !== undefined && REVIEW_NOTE.test(note.text);
    if (heatRank >= HEAT_RISK_RANK || awaitsReview) {
      if (awaitsReview) mentionNote();
      lines.push(`Ризик: ${awaitsReview ? "чекаємо на ревʼю, це блокує реліз." : `задача ${staleLabel} без змін, потрібне рішення щодо пріоритету.`}`);
    }
  } else if (tone === "humor") {
    lines.push(`🚒 *${task.title}*: новини з фронту`);
    if (done.length) { mentionDone(); lines.push(`✅ Вже зроблено: ${titles(done)}.`); }
    if (note) { mentionNote(); lines.push(`🕵️ ${safe(note.text)}`); }
    if (open.length) { mentionOpen(); lines.push(`👀 Далі: ${titles(open)}.`); }
    if (!done.length && !note) lines.push("🫠 Прогресу поки нуль, але настрій бойовий.");
    if (heatRank >= HEAT_RISK_RANK) lines.push(`🌶️ Задача висить ${staleLabel}. Стабільність, яку ми заслужили.`);
  } else {
    lines.push(`*${task.title}*: апдейт`);
    if (done.length) { mentionDone(); lines.push(`Готово: ${titles(done)}.`); }
    if (note) { mentionNote(); lines.push(`Нотатка: ${safe(note.text)}`); }
    if (open.length) { mentionOpen(); lines.push(`Далі: ${titles(open)}.`); }
    if (!done.length && !note && !open.length) lines.push("Поки без помітного прогресу, беру в роботу.");
    if (task.status === "done" && !serious) lines.push("Задачу закрито 🎉");
  }

  return {
    tone,
    text: clip(lines.join("\n"), tone === "short" ? STATUS_UPDATE_SHORT_MAX : STATUS_UPDATE_TEXT.max),
    mentions: { subtaskIds: [...mentioned.subtaskIds], noteIds: [...mentioned.noteIds] },
    thin: task.subtasks.length === 0 && task.notes.length === 0,
  };
};
