"use client";

import { toast } from "sonner";
import { useCreateTask } from "@/features/taskCreate";
import { DeleteTaskDialog } from "@/features/taskDelete";
import { getTaskPatch, taskUpdatedMessage, useUpdateTask } from "@/features/taskEdit";
import { TaskForm } from "@/features/taskForm";
import type { TaskDialogsProps } from "./types";

const focusTaskList = () => document.getElementById("main");

export const TaskDialogs = ({ dialog, serious, onClose, onCreated }: TaskDialogsProps) => {
  const create = useCreateTask();
  const update = useUpdateTask();

  if (dialog.kind === "delete") {
    return <DeleteTaskDialog task={dialog.task} serious={serious} onClose={onClose} fallbackFocus={focusTaskList} />;
  }

  if (dialog.kind === "edit") {
    return <TaskForm task={dialog.task} onClose={onClose} fallbackFocus={focusTaskList} onSave={async (values) => {
      const patch = getTaskPatch(dialog.task, values);
      if (patch) {
        const updated = await update.mutateAsync({ id: dialog.task.id, patch });
        toast.success(taskUpdatedMessage(dialog.task, updated, serious, Date.now()));
      }
      onClose();
    }} />;
  }

  return <TaskForm onClose={onClose} fallbackFocus={focusTaskList} onSave={async (values) => {
    await create.mutateAsync(values);
    toast.success(serious ? "Задачу створено" : "✨ Задачу створено. Поки що вона 🥒 свіжа");
    onCreated();
    onClose();
  }} />;
};
