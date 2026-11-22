"use client";

import { Square } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { formatRunSummary } from "../../lib/formatRunSummary";
import { AgentFallbackAlert } from "../AgentFallbackAlert";
import { AgentPanel } from "../AgentPanel";
import { AgentProgress } from "../AgentProgress";
import { AgentStepList } from "../AgentStepList";
import { runSummaryStyles, stopStyles } from "./styles";
import type { AgentRunPanelProps } from "./types";

/** Спільна обв'язка запуску агента: прогрес, кроки, «Зупинити», fallback і підсумковий рядок. */
export const AgentRunPanel = ({
  title, icon, tagLabel, run, onStop, demo = false, collapsible, summary, fallbackTitle, fallbackMessage, idle, children,
}: AgentRunPanelProps) => {
  const running = run.status === "running";
  const finished = run.status !== "idle" && !running;
  const isDemo = run.mode === null ? demo : run.mode === "demo";

  return (
    <AgentPanel title={title} icon={icon} tagLabel={tagLabel} demo={isDemo} running={running}
      collapsible={collapsible} summary={summary}
    >
      {run.status === "idle" ? idle : null}
      {running ? (
        <>
          <AgentProgress steps={run.steps} />
          <AgentStepList steps={run.steps} />
          <Button variant="ghost" size="sm" className={stopStyles} onClick={onStop}>
            <Square aria-hidden="true" className="size-3.5" />
            Зупинити
          </Button>
        </>
      ) : null}
      {finished ? (
        <>
          <AgentStepList steps={run.steps} />
          {run.status === "fallback" ? (
            <AgentFallbackAlert title={fallbackTitle ?? "Агент не зміг відповісти"}>
              {fallbackMessage ?? `${run.fallbackReason}. Показуємо базове правило без AI.`}
            </AgentFallbackAlert>
          ) : null}
          {run.status === "error" ? (
            <AgentFallbackAlert title="Агент недоступний">{run.error?.message}</AgentFallbackAlert>
          ) : null}
          {children}
          <p className={runSummaryStyles} data-testid="agent-run-summary">{formatRunSummary(run)}</p>
        </>
      ) : null}
    </AgentPanel>
  );
};
