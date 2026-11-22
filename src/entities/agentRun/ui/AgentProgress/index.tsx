import { barStyles, trackStyles } from "./styles";
import type { AgentProgressProps } from "./types";

/** Прогрес = виконані кроки / усі кроки. */
export function AgentProgress({ steps }: AgentProgressProps) {
  const done = steps.filter((step) => step.state === "done").length;
  const percent = steps.length === 0 ? 0 : Math.round((done / steps.length) * 100);
  return (
    <div role="progressbar" aria-label="Прогрес агента" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className={trackStyles}>
      <span className={barStyles} style={{ width: `${percent}%` }} />
    </div>
  );
}
