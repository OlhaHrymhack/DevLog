import { plural } from "@/shared/lib/plural";
import type { AgentRunState } from "../model/agentRunState";

const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(1).replace(".", ",")} с`;

/** Підсумковий рядок запуску: «4 кроки · 2,3 с · мок-відповідь». */
export const formatRunSummary = ({ steps, startedAt, finishedAt, mode }: AgentRunState): string => {
  const parts = [`${steps.length} ${plural(steps.length, "крок", "кроки", "кроків")}`];
  if (startedAt !== null && finishedAt !== null) parts.push(formatSeconds(Math.max(0, finishedAt - startedAt)));
  if (mode === "demo") parts.push("мок-відповідь");
  return parts.join(" · ");
};
