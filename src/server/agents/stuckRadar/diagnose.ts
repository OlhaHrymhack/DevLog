import { STUCK_ACTION_FOR_CAUSE, type StuckAction, type StuckCause } from "@/entities/agentRun";
import type { Task } from "@/entities/task";
import { plural } from "@/shared/lib/plural";

const REVIEW_NOTE = /\bPR\b|ревʼю|рев'ю|\breview\b/i;
export const OPEN_TASKS_THRESHOLD = 3;

export type Diagnosis = { cause: StuckCause; action: StuckAction; why: string };

export const openSubtaskCount = (task: Pick<Task, "subtasks">): number =>
  task.subtasks.filter((subtask) => subtask.status !== "done").length;

/** Правило прототипу (порядок важливий): ревʼю → розмита → завелика → без активності. */
export const diagnose = (task: Pick<Task, "subtasks" | "notes">): Diagnosis => {
  const open = openSubtaskCount(task);
  const result = (cause: StuckCause, why: string): Diagnosis => ({ cause, action: STUCK_ACTION_FOR_CAUSE[cause], why });
  if (task.notes.some((note) => REVIEW_NOTE.test(note.text))) {
    return result("waiting-review", "У нотатці згадано PR, який чекає ревʼю. Блокер поза автором задачі.");
  }
  if (task.subtasks.length === 0 && task.notes.length === 0) {
    return result("vague", "Немає ні підзадач, ні нотаток: незрозуміло, з чого почати.");
  }
  if (open >= OPEN_TASKS_THRESHOLD) {
    return result("too-big", `${open} ${plural(open, "відкрита підзадача", "відкриті підзадачі", "відкритих підзадач")} і жодного руху. Варто попросити допомоги або зменшити обсяг.`);
  }
  return result("no-activity", "Задача давно не оновлювалась.");
};
