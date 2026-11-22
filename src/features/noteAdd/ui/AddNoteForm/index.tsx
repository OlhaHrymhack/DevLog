"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/Button";
import { Textarea } from "@/shared/ui/Textarea";
import { useAddNote } from "../../model/useAddNote";
import { validateNote } from "../../model/validateNote";
import { errorStyles, footerStyles, formStyles, labelStyles } from "./styles";
import type { AddNoteFormProps } from "./types";

export const AddNoteForm = ({ taskId }: AddNoteFormProps) => {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const field = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const addNote = useAddNote(taskId);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const checked = validateNote(text);
    if (!checked.ok) {
      setError(checked.message);
      field.current?.focus();
      return;
    }
    try {
      await addNote.mutateAsync(checked.text);
      setText("");
      setError(undefined);
      toast.success("Нотатку додано");
    } catch {
      setError("Не вдалося додати нотатку. Текст збережено в полі, спробуйте ще раз");
    }
  };

  return (
    <form className={formStyles} noValidate onSubmit={(event) => void submit(event)}>
      <label htmlFor={fieldId} className={labelStyles}>Нова нотатка</label>
      <Textarea
        id={fieldId}
        ref={field}
        value={text}
        placeholder="Що зроблено, що блокує, посилання на PR…"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={({ currentTarget }) => {
          setText(currentTarget.value);
          if (error) setError(undefined);
        }}
      />
      {error && <p id={errorId} role="alert" className={errorStyles}>{error}</p>}
      <div className={footerStyles}>
        <Button type="submit" disabled={addNote.isPending}>Додати нотатку</Button>
      </div>
    </form>
  );
};
