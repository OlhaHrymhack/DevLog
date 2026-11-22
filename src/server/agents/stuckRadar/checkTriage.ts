import { STUCK_ACTION_FOR_CAUSE, STUCK_DRAFT, type StuckRadarInput, type Triage } from "@/entities/agentRun";
import { BROADCAST } from "../core/slackSafety";
import type { AgentContext } from "../core/types";
import { findStaleTasks } from "./staleTasks";

const PR_NUMBER = /\bPR\s*#\d+/gi;
const PR_WORD = /\bPR\b/i;
const canonical = (value: string): string => value.toUpperCase().replace(/\s+/g, "");

/**
 * Перевірка фактів: `taskId` — серед знайдених `find_stale_tasks` (без відкладених), без повторів; `action` відповідає `cause`;
 * чернетка лише для `draft-*` (20–500); для `waiting-review` згадано PR; PR-номери лише з назви й нотаток; без масових згадок Slack.
 */
export const checkTriage = (result: Triage, ctx: AgentContext, input: StuckRadarInput): string[] => {
  const found = new Map(findStaleTasks(ctx, input.snoozedIds).map(({ task }) => [task.id, task]));
  const violations: string[] = [];
  const seen = new Set<string>();
  result.items.forEach((item) => {
    const task = found.get(item.taskId);
    if (!task) return void violations.push(`taskId ${item.taskId}: задачі немає серед знайдених застряглих`);
    if (seen.has(item.taskId)) violations.push(`taskId ${item.taskId}: повтор`);
    seen.add(item.taskId);
    if (STUCK_ACTION_FOR_CAUSE[item.cause] !== item.action) violations.push(`${item.taskId}: дія «${item.action}» не відповідає причині «${item.cause}»`);
    const isDraft = item.action === "draft-review" || item.action === "draft-help";
    if (!isDraft && item.draft !== null) violations.push(`${item.taskId}: чернетка лише для draft-дій`);
    if (isDraft && (item.draft === null || item.draft.length < STUCK_DRAFT.min)) {
      return void violations.push(`${item.taskId}: чернетка ${STUCK_DRAFT.min}–${STUCK_DRAFT.max} символів обов'язкова`);
    }
    const texts = [item.why, item.draft ?? ""];
    if (texts.some((text) => BROADCAST.test(text))) violations.push(`${item.taskId}: масова згадка або службова Slack-розмітка`);
    if (item.action === "draft-review" && item.draft !== null && !PR_WORD.test(item.draft)) violations.push(`${item.taskId}: у чернетці ревʼю не згадано PR`);
    const known = new Set([task.title, ...task.notes.map((note) => note.text)].flatMap((text) => text.match(PR_NUMBER) ?? []).map(canonical));
    texts.flatMap((text) => text.match(PR_NUMBER) ?? []).filter((pr) => !known.has(canonical(pr)))
      .forEach((pr) => violations.push(`У тексті згадано ${pr}, якого немає в нотатках`));
  });
  return violations;
};
