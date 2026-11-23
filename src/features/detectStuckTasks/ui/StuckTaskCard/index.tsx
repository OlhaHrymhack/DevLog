import Link from "next/link";
import { STUCK_ACTION_LABELS, STUCK_CAUSE_LABELS } from "@/entities/agentRun";
import { HEAT_LEVELS } from "@/entities/task";
import { plural } from "@/shared/lib/plural";
import { Button } from "@/shared/ui/Button";
import { stuckJoke } from "../../model/stuckJoke";
import { actionsStyles, cardStyles, causeStyles, jokeStyles, linkStyles, staleStyles, topStyles, whyStyles } from "./styles";
import type { StuckTaskCardProps } from "./types";

/** Картка застряглої задачі: причина, пояснення, жарт (не в серйозному режимі), основна дія й «Ігнорувати». */
export const StuckTaskCard = ({ item, title, staleDays, heat, serious, onAct, onSnooze }: StuckTaskCardProps) => {
  const joke = serious ? "" : stuckJoke(item.cause, staleDays);
  return (
    <article className={cardStyles} aria-label={title}>
      <div className={topStyles}>
        <Link href={`/tasks/${item.taskId}`} className={linkStyles}>{title}</Link>
        <span className={staleStyles({ hot: HEAT_LEVELS[heat].rank >= 2 })}>
          {staleDays} {plural(staleDays, "день", "дні", "днів")} без змін
        </span>
      </div>
      <p className={whyStyles}><span className={causeStyles}>{STUCK_CAUSE_LABELS[item.cause]}.</span> {item.why}</p>
      {joke ? <p className={jokeStyles}>{joke}</p> : null}
      <div className={actionsStyles}>
        <Button size="sm" onClick={() => onAct(item.action, item)}>{STUCK_ACTION_LABELS[item.action]}</Button>
        <Button size="sm" variant="ghost" onClick={() => onSnooze(item.taskId)}>Ігнорувати</Button>
      </div>
    </article>
  );
};
