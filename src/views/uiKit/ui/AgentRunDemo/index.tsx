"use client";

import { Sparkles } from "lucide-react";
import { AgentRunPanel, isAgentRunDecided, useAgentRun } from "@/entities/agentRun";
import { Button } from "@/shared/ui/Button";
import { APPLIED_NOTE_CLASS, DECISION_ROW_CLASS } from "./styles";

/** Приклад запуску агента для UI Kit: потік підставляє Playwright (перехоплення POST), окремого endpoint немає. */
export const AgentRunDemo = () => {
  const { run, start, stop, dismiss, markApplied } = useAgentRun("prioritize");
  const launch = () => void start({});

  return (
    <AgentRunPanel title="Запуск агента" icon={<Sparkles aria-hidden="true" className="size-4" />} tagLabel="Агент A"
      run={run} onStop={stop}
      idle={<Button variant="ai" className="self-start" onClick={launch}>Запустити агента</Button>}
    >
      {isAgentRunDecided(run.status) ? (
        <div className={DECISION_ROW_CLASS}>
          <Button size="sm" onClick={markApplied}>Застосувати</Button>
          <Button variant="ghost" size="sm" onClick={dismiss}>Відхилити</Button>
        </div>
      ) : null}
      {run.status === "applied" ? <p className={APPLIED_NOTE_CLASS}>Застосовано</p> : null}
      {run.status === "error" ? <Button variant="ghost" size="sm" className="self-start" onClick={launch}>Спробувати ще раз</Button> : null}
    </AgentRunPanel>
  );
};
