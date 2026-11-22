import type { AgentRunViewStatus } from "../model/agentRunState";

const DECIDED_STATUSES: readonly AgentRunViewStatus[] = ["result", "clarify", "fallback"];

/** Результат агента готовий до рішення користувача (застосувати чи відхилити). */
export const isAgentRunDecided = (status: AgentRunViewStatus): boolean => DECIDED_STATUSES.includes(status);
