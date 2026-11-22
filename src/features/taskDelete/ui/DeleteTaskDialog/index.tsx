"use client";

import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { toast } from "sonner";
import { taskApi, taskQueryKeys } from "@/entities/task";
import { plural } from "@/shared/lib/plural";
import { Button } from "@/shared/ui/Button";
import { ResponsiveDialog } from "@/shared/ui/ResponsiveDialog";
import { useDeleteTask } from "../../model/useDeleteTask";
import { disabledStyles } from "./styles";
import type { DeleteTaskDialogProps } from "./types";

export const DeleteTaskDialog = ({ task, serious, onClose, onDeleted = onClose, fallbackFocus }: DeleteTaskDialogProps) => {
  const confirm = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const deletion = useDeleteTask();
  const details = useQuery({
    queryKey: taskQueryKeys.detail(task.id),
    queryFn: ({ signal }) => taskApi.get(task.id, signal),
  });
  const canDelete = details.isSuccess && !details.isFetching && !deletion.isPending;
  const close = () => { if (!submitting.current) onClose(); };

  const deleteTask = async () => {
    if (!canDelete || submitting.current) return;
    submitting.current = true;
    try {
      await deletion.mutateAsync(task.id);
      toast.success(serious ? "Задачу видалено" : "🪦 Видалено. Ніхто й не помітить");
      onDeleted();
    } catch {
      toast.error("Не вдалося видалити задачу. Спробуйте ще раз");
    } finally {
      submitting.current = false;
    }
  };

  const { subtasks = [], notes = [] } = details.data ?? {};
  const children = `${subtasks.length} ${plural(subtasks.length, "підзадачею", "підзадачами", "підзадачами")}`;
  const comments = `${notes.length} ${plural(notes.length, "нотаткою", "нотатками", "нотатками")}`;
  const description = details.isSuccess
    ? `«${details.data.title}» буде видалено разом із ${children} і ${comments}. Цю дію не можна скасувати.`
    : `«${task.title}» буде видалено. Цю дію не можна скасувати.`;

  return (
    <ResponsiveDialog open onOpenChange={(open) => { if (!open) close(); }}
      title="Видалити задачу?" description={description}
      initialFocus={confirm} fallbackFocus={fallbackFocus}
      actions={<>
        <Button variant="ghost" onClick={close} disabled={deletion.isPending}>Скасувати</Button>
        <Button ref={confirm} variant="danger" aria-disabled={!canDelete} className={disabledStyles}
          onClick={() => void deleteTask()}
        >
          Видалити
        </Button>
      </>}
    >
      {details.isPending && <p role="status">Завантажуємо дані задачі…</p>}
      {details.isError && (
        <div role="alert">
          <p>Не вдалося завантажити дані задачі.</p>
          <Button variant="ghost" onClick={() => void details.refetch()} disabled={details.isFetching}>Спробувати ще раз</Button>
        </div>
      )}
    </ResponsiveDialog>
  );
};
