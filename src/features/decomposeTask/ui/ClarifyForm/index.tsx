"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/shared/ui/Button";
import { Textarea } from "@/shared/ui/Textarea";
import { validateClarification } from "../../model/clarification";
import { actionsStyles, bubbleStyles, errorStyles, formStyles, hintStyles, labelStyles } from "./styles";
import type { ClarifyFormProps } from "./types";

/** Питання агента й поле відповіді: підзадачі не генеруються, доки немає відповіді. */
export const ClarifyForm = ({ questions, serious, pending, onSubmit, onCancel }: ClarifyFormProps) => {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const field = useRef<HTMLTextAreaElement>(null);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string>();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const checked = validateClarification(answer);
    if (!checked.ok) {
      setError(checked.message);
      field.current?.focus();
      return;
    }
    setError(undefined);
    onSubmit(checked.text);
  };

  return (
    <>
      <div className={bubbleStyles}>
        <p className="m-0">{serious ? "" : "🤔 "}Опису замало, щоб розбити задачу. Уточніть, будь ласка:</p>
        <ol className="m-0 mt-1 list-none p-0">
          {questions.map((question, index) => <li key={`${index}-${question}`}>{index + 1}. {question}</li>)}
        </ol>
      </div>
      <form className={formStyles} noValidate onSubmit={submit}>
        <label htmlFor={fieldId} className={labelStyles}>Ваша відповідь</label>
        <Textarea id={fieldId} ref={field} value={answer} disabled={pending} placeholder="Наприклад: e2e checkout, падає ~1 з 8 запусків у CI"
          aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined}
          onChange={(event) => { setAnswer(event.currentTarget.value); setError(undefined); }}
        />
        {error ? <p id={errorId} className={errorStyles}>{error}</p> : null}
        <div className={actionsStyles}>
          <Button type="submit" className="grow" disabled={pending}>Відповісти і продовжити</Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>Скасувати</Button>
        </div>
      </form>
      <p className={hintStyles}>Підзадачі не генеруються, доки немає відповіді.</p>
    </>
  );
};
