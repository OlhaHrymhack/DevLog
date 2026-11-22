"use client";

import { useId, useState } from "react";
import { plural } from "@/shared/lib/plural";
import { Button } from "@/shared/ui/Button";
import { Checkbox } from "@/shared/ui/Checkbox";
import { actionsStyles, hintStyles, itemStyles, labelStyles, listStyles, metaStyles, titleStyles } from "./styles";
import type { SubtaskSuggestionsProps } from "./types";

/** Пропоновані підзадачі з чекбоксами (усі увімкнені); створюються лише обрані, лише після «Створити». */
export const SubtaskSuggestions = ({ items, pending, onCreate, onCancel }: SubtaskSuggestionsProps) => {
  const groupId = useId();
  const [selected, setSelected] = useState<boolean[]>(() => items.map(() => true));
  const chosen = items.filter((_, index) => selected[index]);
  const count = chosen.length;

  return (
    <>
      <p className={labelStyles}>Пропоновані підзадачі</p>
      <ul className={listStyles}>
        {items.map((entry, index) => (
          <li key={`${index}-${entry.title}`} className={itemStyles}>
            <Checkbox id={`${groupId}-${index}`} checked={selected[index] ?? false} disabled={pending}
              onCheckedChange={(value) => setSelected((current) => current.map((on, at) => (at === index ? value === true : on)))}
            />
            <label htmlFor={`${groupId}-${index}`} className="min-w-0">
              <span className={titleStyles}>{entry.title}</span>
              <span className={metaStyles}> {entry.estimate} · {entry.rationale}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className={actionsStyles}>
        <Button className="grow" disabled={count === 0 || pending} onClick={() => onCreate(chosen)}>
          Створити {count} {plural(count, "підзадачу", "підзадачі", "підзадач")}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={onCancel}>Скасувати</Button>
      </div>
      <p className={hintStyles}>Нічого не створено, доки ви не натиснете «Створити».</p>
    </>
  );
};
