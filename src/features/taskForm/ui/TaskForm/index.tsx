"use client";

import { useId, useRef, useState } from "react";
import { PRIORITY_LABELS, STATUS_LABELS, TaskPrioritySchema, TaskStatusSchema } from "@/entities/task";
import { formatDate } from "@/shared/lib/formatDate";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { ResponsiveDialog } from "@/shared/ui/ResponsiveDialog";
import { Textarea } from "@/shared/ui/Textarea";
import { fromLocalDateTime, toLocalDateTime } from "../../model/localDateTime";
import { useVoiceTaskDraft } from "../../model/useVoiceTaskDraft";
import { VoiceDraftControls } from "../VoiceDraftControls";
import { useTaskForm } from "../../model/useTaskForm";
import { EMPTY_TASK_FORM } from "../../model/validation";
import { descriptionStyles, errorStyles, fieldStyles, formStyles, groupStyles, hintStyles, inputStyles, labelStyles, noteStyles, optionStyles } from "./styles";
import type { TaskFormProps } from "./types";

export const TaskForm = ({ task, voiceMode, onSave, onClose, fallbackFocus }: TaskFormProps) => {
  const id = useId();
  const titleInput = useRef<HTMLInputElement>(null);
  const deadlineInput = useRef<HTMLInputElement>(null);
  const [invalidDeadline, setInvalidDeadline] = useState<string>();
  const initialValues = task
    ? { title: task.title, description: task.description, status: task.status, priority: task.priority, dueAt: task.dueAt ?? undefined }
    : EMPTY_TASK_FORM;
  const { form, values, errors, pending, change, applyDraft, submit } = useTaskForm(initialValues, onSave);
  const voice = useVoiceTaskDraft(({ title, description, priority, dueAtLocal }) => {
    const dueAt = dueAtLocal ? fromLocalDateTime(dueAtLocal) : undefined;
    setInvalidDeadline(dueAtLocal && !dueAt ? dueAtLocal : undefined);
    applyDraft({ title, description, priority, dueAt });
  });
  const voiceBusy = voice.phase !== "idle";
  const deadlineValue = invalidDeadline ?? (values.dueAt ? toLocalDateTime(new Date(values.dueAt)) : "");
  const deadlineError = invalidDeadline ? "Вкажіть дійсні дату й час для свого часового поясу." : errors.dueAt;
  const changeDeadline = (value: string) => {
    const dueAt = fromLocalDateTime(value);
    setInvalidDeadline(value && !dueAt ? value : undefined);
    change("dueAt", dueAt);
  };
  const hasShortDescription = values.description.trim().length > 0 && values.description.trim().length < 40;
  const descriptionReferences = [
    errors.description && `${id}-description-error`,
    hasShortDescription && `${id}-description-hint`,
  ].filter(Boolean).join(" ");
  const close = () => { if (!pending) onClose(); };
  const formId = `${id}-form`;

  return (
    <ResponsiveDialog open onOpenChange={(open) => { if (!open) close(); }}
      title={task ? "Редагувати задачу" : "Нова задача"}
      initialFocus={titleInput}
      fallbackFocus={fallbackFocus}
      actions={<>
        <Button variant="ghost" onClick={close} disabled={pending}>Скасувати</Button>
        <Button type="submit" form={formId} disabled={pending || voiceBusy}>{task ? "Зберегти" : "Створити"}</Button>
      </>}
    >
      <form ref={form} id={formId} onSubmit={(event) => {
        if (voiceBusy || invalidDeadline) {
          event.preventDefault();
          if (invalidDeadline) deadlineInput.current?.focus();
          return;
        }
        void submit(event);
      }} noValidate aria-busy={pending}>
        {!task && <VoiceDraftControls {...voice} id={id + "-voice-guide"} mode={voiceMode} disabled={pending} />}
        <fieldset className={formStyles} disabled={pending || voiceBusy} aria-label="Дані задачі">
          <div className={fieldStyles}>
            <label htmlFor={`${id}-title`} className={labelStyles}>Назва *</label>
            <Input id={`${id}-title`} ref={titleInput} name="title" required className={inputStyles}
              value={values.title} placeholder="Наприклад: Виправити флакі тест"
              onChange={(event) => change("title", event.currentTarget.value)}
              aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? `${id}-title-error` : undefined}
            />
            {errors.title && <p id={`${id}-title-error`} className={errorStyles}>{errors.title}</p>}
          </div>
          <div className={fieldStyles}>
            <label htmlFor={`${id}-description`} className={labelStyles}>Опис *</label>
            <Textarea id={`${id}-description`} name="description" required className={descriptionStyles}
              value={values.description} placeholder="Що потрібно зробити і навіщо"
              onChange={(event) => change("description", event.currentTarget.value)}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={descriptionReferences || undefined}
            />
            {errors.description && <p id={`${id}-description-error`} className={errorStyles}>{errors.description}</p>}
            {hasShortDescription && <p id={`${id}-description-hint`} className={hintStyles}>✦ Опис короткий: агент декомпозиції попросить уточнення.</p>}
          </div>
          <div className={fieldStyles}>
            <span id={`${id}-status`} className={labelStyles}>Статус</span>
            <div role="radiogroup" aria-labelledby={`${id}-status`} className={groupStyles}
              aria-invalid={Boolean(errors.status)} aria-describedby={errors.status ? `${id}-status-error` : undefined}
            >
              {TaskStatusSchema.options.map((status) => (
                <label key={status}>
                  <input name="status" type="radio" value={status} className="peer sr-only" checked={values.status === status} onChange={() => change("status", status)} />
                  <span className={optionStyles}>{STATUS_LABELS[status]}</span>
                </label>
              ))}
            </div>
            {errors.status && <p id={`${id}-status-error`} className={errorStyles}>{errors.status}</p>}
          </div>
          <div className={fieldStyles}>
            <span id={`${id}-priority`} className={labelStyles}>Пріоритет</span>
            <div role="radiogroup" aria-labelledby={`${id}-priority`} className={groupStyles}
              aria-invalid={Boolean(errors.priority)} aria-describedby={errors.priority ? `${id}-priority-error` : undefined}
            >
              {[...TaskPrioritySchema.options].reverse().map((priority) => (
                <label key={priority}>
                  <input name="priority" type="radio" value={priority} className="peer sr-only" checked={values.priority === priority} onChange={() => change("priority", priority)} />
                  <span className={optionStyles}>{PRIORITY_LABELS[priority]}</span>
                </label>
              ))}
            </div>
            {errors.priority && <p id={`${id}-priority-error`} className={errorStyles}>{errors.priority}</p>}
          </div>
          <div className={fieldStyles}>
            <label htmlFor={id + "-dueAt"} className={labelStyles}>Дедлайн</label>
            <Input id={id + "-dueAt"} ref={deadlineInput} name="dueAt" type="datetime-local" className={inputStyles}
              value={deadlineValue} onChange={({ currentTarget }) => changeDeadline(currentTarget.value)}
              aria-invalid={Boolean(deadlineError)} aria-describedby={deadlineError ? id + "-dueAt-error" : undefined}
            />
            {deadlineError && <p id={id + "-dueAt-error"} className={errorStyles}>{deadlineError}</p>}
          </div>
          <p className={noteStyles}>{task ? `Створено ${formatDate(task.createdAt)}. Дата створення не редагується.` : "Дата створення проставляється автоматично."}</p>
        </fieldset>
      </form>
    </ResponsiveDialog>
  );
};
