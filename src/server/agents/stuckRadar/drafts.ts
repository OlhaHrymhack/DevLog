import { STUCK_DRAFT, type TriageItem } from "@/entities/agentRun";
import type { Task } from "@/entities/task";
import { plural } from "@/shared/lib/plural";
import { neutralizeMentions } from "../core/slackSafety";
import { diagnose, openSubtaskCount } from "./diagnose";

const PR_NUMBER = /\bPR\s*#\d+/i;
const MAX_TITLE = 120;

const titleOf = (task: Pick<Task, "title">): string => neutralizeMentions(task.title.length > MAX_TITLE ? `${task.title.slice(0, MAX_TITLE - 1)}…` : task.title);

/** PR із нотаток («PR #318») або просто «PR», якщо номера немає. */
export const prReference = (task: Pick<Task, "notes">): string => {
  for (const note of task.notes) {
    const match = note.text.match(PR_NUMBER);
    if (match) return match[0].replace(/\s+/g, " ").replace(/^pr/i, "PR");
  }
  return "PR";
};

export const reviewDraft = (task: Pick<Task, "title" | "notes">): string =>
  `Привіт! Можеш глянути ${prReference(task)} по задачі «${titleOf(task)}»? Він блокує реліз фіксу, ревʼю займе ~15 хв. Дякую 🙏`;

export const helpDraft = (task: Pick<Task, "title" | "subtasks">): string => {
  const open = openSubtaskCount(task);
  return `Привіт! Задача «${titleOf(task)}» вийшла більшою, ніж здавалось: ${open} ${plural(open, "відкрита підзадача", "відкриті підзадачі", "відкритих підзадач")}. Хтось може взяти одну з них? Деталі в DevLog.`;
};

/** Елемент результату за правилом: з чернеткою для `draft-*`. */
export const buildItem = (task: Task): TriageItem => {
  const { cause, action, why } = diagnose(task);
  const draft = action === "draft-review" ? reviewDraft(task) : action === "draft-help" ? helpDraft(task) : null;
  return { taskId: task.id, cause, why, action, draft: draft && draft.length >= STUCK_DRAFT.min ? draft.slice(0, STUCK_DRAFT.max) : draft };
};

/** Fallback: ті самі задачі, усі з дією `open`, без порад і чернеток. */
export const buildFallbackItem = (task: Task): TriageItem => {
  return { taskId: task.id, cause: "no-activity", why: "Задача давно не оновлювалась.", action: "open", draft: null };
};
