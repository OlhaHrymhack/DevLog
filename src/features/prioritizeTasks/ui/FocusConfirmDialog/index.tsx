"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/Button";
import { ResponsiveDialog } from "@/shared/ui/ResponsiveDialog";
import { useApplyFocus } from "../../model/useApplyFocus";
import type { FocusConfirmDialogProps } from "./types";

export const FocusConfirmDialog = ({ tasks, fromRule = false, serious, onClose, onApplied }: FocusConfirmDialogProps) => {
  const confirm = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const focus = useApplyFocus();
  const close = () => { if (!submitting.current) onClose(); };

  const apply = async () => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      await focus.mutateAsync(tasks.map((task) => task.id));
      toast.success(serious ? "Фокус дня закріплено" : "🎯 Фокус дня закріплено. Тепер точно без прокрастинації");
      onApplied();
    } catch {
      toast.error("Не вдалося закріпити фокус. Спробуйте ще раз");
    } finally {
      submitting.current = false;
    }
  };

  return (
    <ResponsiveDialog open onOpenChange={(open) => { if (!open) close(); }}
      title={fromRule ? "Закріпити порядок за правилом?" : "Закріпити фокус дня?"}
      description="Ці задачі отримають позначку «Фокус» у списку. Статуси й пріоритети не зміняться."
      initialFocus={confirm}
      actions={<>
        <Button variant="ghost" onClick={close} disabled={focus.isPending}>Скасувати</Button>
        <Button ref={confirm} onClick={() => void apply()} disabled={focus.isPending}>Закріпити</Button>
      </>}
    >
      <ol className="m-0 list-none space-y-1 p-0 text-sm text-fg" aria-label="Порядок фокусу">
        {tasks.map((task, index) => <li key={task.id}>{index + 1}. {task.title}</li>)}
      </ol>
    </ResponsiveDialog>
  );
};
