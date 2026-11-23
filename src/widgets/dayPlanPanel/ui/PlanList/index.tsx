import Link from "next/link";
import { itemStyles, jokeStyles, listStyles, numberStyles, titleStyles, whyStyles } from "./styles";
import type { PlanListProps } from "./types";

/** Нумерований план: номер у колі, назва-посилання на задачу, пояснення й жарт агента (якщо є). */
export const PlanList = ({ entries }: PlanListProps) => (
  <ol className={listStyles} aria-label="План на день">
    {entries.map((entry, index) => (
      <li key={entry.id} className={itemStyles}>
        <span className={numberStyles} aria-hidden="true">{index + 1}</span>
        <div className="min-w-0">
          <Link href={`/tasks/${entry.id}`} className={titleStyles}>{entry.title}</Link>
          {entry.why ? <p className={whyStyles}>{entry.why}</p> : null}
          {entry.joke ? <p className={jokeStyles}>{entry.joke}</p> : null}
        </div>
      </li>
    ))}
  </ol>
);
