import type { AgentEvent, AgentStepState } from "@/entities/agentRun";

export const isConfirmed = (answer: string): boolean => answer.trim().toLowerCase() === "yes";

export type SmokeSummary = {
  final: AgentEvent["type"] | "none";
  steps: AgentStepState[];
  fallbackReason?: string;
  errorCode?: string;
};

/** Лише метрики запуску: без результату агента, промптів і даних задач. */
export const summarizeSmokeEvents = (events: readonly AgentEvent[]): SmokeSummary => {
  const steps: AgentStepState[] = [];
  let summary: SmokeSummary = { final: "none", steps };
  for (const event of events) {
    if (event.type === "run") event.steps.forEach((_step, index) => { steps[index] = "pending"; });
    if (event.type === "step") steps[event.index] = event.state;
    if (event.type === "result" || event.type === "stopped") summary = { ...summary, final: event.type };
    if (event.type === "fallback") summary = { ...summary, final: "fallback", fallbackReason: event.reason };
    if (event.type === "error") summary = { ...summary, final: "error", errorCode: event.error.code };
  }
  return { ...summary, steps };
};
