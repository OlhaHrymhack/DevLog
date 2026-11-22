"use client";

import { toast } from "sonner";
import { Button } from "@/shared/ui/Button";
import { ResponsiveDialog } from "@/shared/ui/ResponsiveDialog";
import { bubbleStyles, hintStyles } from "./styles";
import type { DraftMessageDialogProps } from "./types";

/** Чернетка повідомлення від агента D: лише показ і копіювання; нічого не надсилається. */
export const DraftMessageDialog = ({ title, draft, onClose }: DraftMessageDialogProps) => {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      toast.success("Чернетку скопійовано");
    } catch {
      toast.error("Не вдалося скопіювати. Виділіть текст вручну");
    }
  };
  const discard = () => {
    toast("Чернетку відхилено");
    onClose();
  };

  return (
    <ResponsiveDialog open onOpenChange={(open) => { if (!open) onClose(); }} title={title}
      actions={<>
        <Button variant="ghost" onClick={discard}>Відхилити</Button>
        <Button variant="ghost" onClick={onClose}>Закрити</Button>
        <Button onClick={() => void copy()}>Скопіювати</Button>
      </>}
    >
      <p className={bubbleStyles} data-testid="draft-text">{draft}</p>
      <p className={hintStyles}>Агент нічого не надсилає сам. Скопіюйте й вставте в Slack.</p>
    </ResponsiveDialog>
  );
};
