import { Check, X } from "lucide-react";
import type { AgentStepState } from "../../model/types";
import { detailStyles, pendingStyles, spinnerStyles, stepIconSlotStyles, stepListStyles, stepStyles } from "./styles";
import type { AgentStepListProps } from "./types";

const STATE_TEXT: Record<AgentStepState, string> = {
  pending: "очікує",
  run: "виконується",
  done: "готово",
  fail: "помилка",
};

function StepIcon({ state }: { state: AgentStepState }) {
  if (state === "run") return <span aria-hidden="true" className={spinnerStyles} />;
  if (state === "done") return <Check aria-hidden="true" strokeWidth={3} className="size-3.5 animate-pop text-success" />;
  if (state === "fail") return <X aria-hidden="true" strokeWidth={3} className="size-3.5" />;
  return <span aria-hidden="true" className={pendingStyles} />;
}

export function AgentStepList({ steps }: AgentStepListProps) {
  if (steps.length === 0) return null;
  return (
    <ol className={stepListStyles} aria-live="polite">
      {steps.map((step, index) => (
        <li key={`${index}-${step.label}`} data-state={step.state} className={stepStyles({ state: step.state })}>
          <span className={stepIconSlotStyles}>
            <StepIcon state={step.state} />
          </span>
          <span>
            {step.label}
            <span className="sr-only"> — {STATE_TEXT[step.state]}</span>
            {step.detail ? <span className={detailStyles}>{step.detail}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
