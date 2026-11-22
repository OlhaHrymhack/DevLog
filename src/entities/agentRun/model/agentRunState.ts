import type { AgentError, AgentEvent, AgentRunMode, AgentStep } from "./types";

/** Клієнтський життєвий цикл: idle → running → result | clarify | fallback → applied (+ error). */
export type AgentRunViewStatus = "idle" | "running" | "result" | "clarify" | "fallback" | "applied" | "error";

export type AgentRunState = {
  status: AgentRunViewStatus;
  runId: string | null;
  mode: AgentRunMode | null;
  steps: AgentStep[];
  data: unknown;
  fallbackReason: string | null;
  error: AgentError | null;
  startedAt: number | null;
  finishedAt: number | null;
};

export const IDLE_AGENT_RUN: AgentRunState = {
  status: "idle", runId: null, mode: null, steps: [], data: null,
  fallbackReason: null, error: null, startedAt: null, finishedAt: null,
};

export const STREAM_ENDED_ERROR: AgentError = { code: "STREAM_ENDED", message: "Відповідь агента обірвалася без результату" };

export const startAgentRunState = (now: number): AgentRunState => ({ ...IDLE_AGENT_RUN, status: "running", startedAt: now });

export const failAgentRunState = (state: AgentRunState, error: AgentError, now: number): AgentRunState =>
  state.status === "running" ? { ...state, status: "error", error, finishedAt: now } : state;

/** Чиста функція переходів; події поза `running` (пізні) ігноруються. */
export const applyAgentEvent = (state: AgentRunState, event: AgentEvent, now: number): AgentRunState => {
  if (state.status !== "running") return state;
  switch (event.type) {
    case "run":
      return { ...state, runId: event.runId, mode: event.mode, steps: event.steps.map(({ label }) => ({ label, state: "pending" })) };
    case "step": {
      if (event.index >= state.steps.length) return state;
      const steps = state.steps.map((step, index) => index === event.index
        ? { label: event.label, state: event.state, ...(event.detail ? { detail: event.detail } : {}) }
        : step);
      return { ...state, steps };
    }
    case "result":
      return { ...state, status: event.status, data: event.data, finishedAt: now };
    case "fallback":
      return { ...state, status: "fallback", data: event.data, fallbackReason: event.reason, finishedAt: now };
    case "stopped":
      return IDLE_AGENT_RUN;
    case "error":
      return { ...state, status: "error", error: event.error, finishedAt: now };
  }
};
