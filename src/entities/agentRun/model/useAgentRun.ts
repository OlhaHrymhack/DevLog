"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/shared/api/http";
import { getForceInvalidOutput } from "@/shared/lib/hooks/useForceInvalidOutput";
import { streamAgentRun } from "../api/agentRunApi";
import { isAgentRunDecided } from "../lib/isAgentRunDecided";
import {
  applyAgentEvent, failAgentRunState, IDLE_AGENT_RUN, startAgentRunState, STREAM_ENDED_ERROR, type AgentRunState,
} from "./agentRunState";
import { AGENT_FINAL_EVENT_TYPES } from "./events";
import type { AgentError, AgentRunKind } from "./types";

const UNKNOWN_ERROR: AgentError = { code: "AGENT_ERROR", message: "Агент недоступний" };

const toAgentError = (error: unknown): AgentError =>
  error instanceof ApiError ? { code: error.code, message: error.message } : UNKNOWN_ERROR;

/**
 * Запуск агента зі стрімом кроків. `stop()` перериває запит (сервер отримує abort) і повертає `idle`;
 * події попереднього чи зупиненого запуску відкидаються.
 */
export const useAgentRun = (kind: AgentRunKind) => {
  const [state, setState] = useState<AgentRunState>(IDLE_AGENT_RUN);
  const controllerRef = useRef<AbortController | null>(null);
  const tokenRef = useRef(0);

  const cancelCurrent = useCallback(() => {
    tokenRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  useEffect(() => cancelCurrent, [cancelCurrent]);

  const start = useCallback(async (input: unknown) => {
    cancelCurrent();
    const token = tokenRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    const isCurrent = () => tokenRef.current === token;
    let finished = false;
    setState(startAgentRunState(Date.now()));

    try {
      await streamAgentRun({
        kind,
        input,
        forceInvalidOutput: getForceInvalidOutput(),
        signal: controller.signal,
        onEvent: (event) => {
          if (!isCurrent() || finished) return;
          finished = AGENT_FINAL_EVENT_TYPES.some((type) => type === event.type);
          setState((current) => applyAgentEvent(current, event, Date.now()));
        },
      });
      if (isCurrent() && !finished) setState((current) => failAgentRunState(current, STREAM_ENDED_ERROR, Date.now()));
    } catch (error) {
      if (controller.signal.aborted || !isCurrent()) return;
      setState((current) => failAgentRunState(current, toAgentError(error), Date.now()));
    } finally {
      if (isCurrent()) controllerRef.current = null;
    }
  }, [cancelCurrent, kind]);

  const stop = useCallback(() => {
    cancelCurrent();
    setState(IDLE_AGENT_RUN);
  }, [cancelCurrent]);

  const reset = stop;

  const dismiss = useCallback(() => {
    cancelCurrent();
    setState(IDLE_AGENT_RUN);
    toast("Відхилено");
  }, [cancelCurrent]);

  const markApplied = useCallback(() => {
    setState((current) => isAgentRunDecided(current.status) ? { ...current, status: "applied" } : current);
  }, []);

  return { run: state, start, stop, reset, dismiss, markApplied };
};
