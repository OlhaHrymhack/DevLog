"use client";

import { ArrowLeft, FileText, ListTree, MessageSquare } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useHealth } from "@/shared/api/health/useHealth";
import { ApiError } from "@/shared/api/http";
import { useTask, type Subtask, type SubtaskStatus, type TaskPriority, type TaskStatus } from "@/entities/task";
import { useSerious } from "@/features/seriousMode";
import { useDeleteSubtask, useSetSubtaskStatus } from "@/features/subtaskChange";
import { useUpdateTask } from "@/features/taskEdit";
import { useMediaQuery } from "@/shared/lib/hooks/useMediaQuery";
import { Button } from "@/shared/ui/Button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/Tabs";
import { AppHeader } from "@/widgets/appHeader";
import { DecomposePanel } from "@/widgets/decomposePanel";
import { NoteList } from "@/widgets/noteList";
import { StatusUpdatePanel } from "@/widgets/statusUpdatePanel";
import { areAllSubtasksDone, SubtaskList } from "@/widgets/subtaskList";
import { TaskDialogs, type TaskDialog } from "@/widgets/taskDialogs";
import { TaskOverview } from "@/widgets/taskOverview";
import { parseDetailsTab } from "../../model/detailsTab";
import { allSubtasksDoneMessage, priorityChangedMessage, statusChangedMessage } from "../../model/messages";
import { useDetailsTab } from "../../model/useDetailsTab";
import { TaskDetailsSkeleton } from "../TaskDetailsSkeleton";
import { backStyles, columnStyles, layoutStyles, mainStyles, skipLinkStyles, tabsListStyles } from "./styles";
import type { TaskDetailsViewProps } from "./types";

export const TaskDetailsView = ({ id }: TaskDetailsViewProps) => {
  const router = useRouter();
  const task = useTask(id);
  const serious = useSerious();
  const health = useHealth();
  const [now] = useState(() => Date.now());
  const [dialog, setDialog] = useState<TaskDialog>();
  const { tab, setTab } = useDetailsTab();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [autorun, setAutorun] = useState(() => searchParams.get("autorun") === "1");
  const consumeAutorun = useCallback(() => {
    setAutorun(false);
    const params = new URLSearchParams(window.location.search);
    if (!params.has("autorun")) return;
    params.delete("autorun");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router]);
  const wide = useMediaQuery("(min-width: 1024px)");
  const update = useUpdateTask();
  const setSubtaskStatus = useSetSubtaskStatus();
  const deleteSubtask = useDeleteSubtask();
  const pending = update.isPending || setSubtaskStatus.isPending || deleteSubtask.isPending;

  const notFound = task.error instanceof ApiError && task.error.status === 404;
  const current = notFound ? undefined : task.data;

  const changeStatus = async (status: TaskStatus) => {
    if (!current || status === current.status) return;
    try {
      const updated = await update.mutateAsync({ id, patch: { status } });
      toast.success(statusChangedMessage(current, updated, serious, Date.now()));
    } catch {
      toast.error("Не вдалося змінити статус. Спробуйте ще раз");
    }
  };

  const changePriority = async (priority: TaskPriority) => {
    if (!current || priority === current.priority) return;
    try {
      toast.success(priorityChangedMessage(await update.mutateAsync({ id, patch: { priority } })));
    } catch {
      toast.error("Не вдалося змінити пріоритет. Спробуйте ще раз");
    }
  };

  const toggleSubtask = async (subtask: Subtask) => {
    if (!current) return;
    const status: SubtaskStatus = subtask.status === "done" ? "todo" : "done";
    try {
      await setSubtaskStatus.mutateAsync({ taskId: id, subtaskId: subtask.id, status });
      const after = current.subtasks.map((item) => (item.id === subtask.id ? { ...item, status } : item));
      if (current.status !== "done" && areAllSubtasksDone(after)) toast.success(allSubtasksDoneMessage(serious));
    } catch {
      toast.error("Не вдалося оновити підзадачу. Спробуйте ще раз");
    }
  };

  const removeSubtask = async (subtask: Subtask) => {
    try {
      await deleteSubtask.mutateAsync({ taskId: id, subtaskId: subtask.id });
      toast.success("Підзадачу видалено");
    } catch {
      toast.error("Не вдалося видалити підзадачу. Спробуйте ще раз");
    }
  };

  const overview = current && (
    <TaskOverview task={current} serious={serious} now={now} pending={pending}
      onEdit={() => setDialog({ kind: "edit", task: current })}
      onDelete={() => setDialog({ kind: "delete", task: current })}
      onStatusChange={(status) => void changeStatus(status)}
      onPriorityChange={(priority) => void changePriority(priority)}
    />
  );
  const details = current && (
    <>
      <SubtaskList subtasks={current.subtasks} pending={pending}
        onToggle={(subtask) => void toggleSubtask(subtask)}
        onDelete={(subtask) => void removeSubtask(subtask)}
        onDecompose={() => { setAutorun(true); setTab("decompose"); }}
      />
      <NoteList notes={current.notes} now={now} taskId={id} />
    </>
  );

  return (
    <>
      <a href="#main" className={skipLinkStyles}>Перейти до вмісту</a>
      <AppHeader />
      <main id="main" tabIndex={-1} className={mainStyles}>
        <Link href="/" className={backStyles}>
          <ArrowLeft aria-hidden="true" className="size-4" /> Задачі
        </Link>

        {task.isPending && <TaskDetailsSkeleton />}
        {notFound && (
          <EmptyState emoji="🕳️" title="Задачу не знайдено"
            description={serious ? "Можливо, її видалили." : "Можливо, її видалили. Ніхто й не помітив 🪦"}
            action={<Button asChild><Link href="/">До списку</Link></Button>}
          />
        )}
        {task.isError && !notFound && !current && (
          <EmptyState tone="error" emoji="🔌" title="Не вдалося завантажити задачу"
            description={`GET /api/tasks/${id} → ${task.error instanceof ApiError && task.error.status ? task.error.status : "помилка"}`}
            action={<Button onClick={() => void task.refetch()} disabled={task.isFetching}>Спробувати ще раз</Button>}
          />
        )}

        {current && wide && (
          <div className={layoutStyles}>
            <div className={columnStyles}>{overview}{details}</div>
            <aside aria-label="AI-агенти" className={columnStyles}>
              <DecomposePanel task={current} serious={serious} demo={health.data?.aiMode === "demo"} autorun={autorun} onAutorunHandled={consumeAutorun} />
              <StatusUpdatePanel task={current} serious={serious} demo={health.data?.aiMode === "demo"} />
            </aside>
          </div>
        )}
        {current && !wide && (
          <Tabs value={tab} onValueChange={(value) => setTab(parseDetailsTab(value))}>
            <TabsList className={tabsListStyles}>
              <TabsTrigger value="task"><FileText aria-hidden="true" className="max-[419px]:hidden" /> Задача</TabsTrigger>
              <TabsTrigger value="decompose"><ListTree aria-hidden="true" className="max-[419px]:hidden" /> Підзадачі</TabsTrigger>
              <TabsTrigger value="update"><MessageSquare aria-hidden="true" className="max-[419px]:hidden" /> Апдейт</TabsTrigger>
            </TabsList>
            <TabsContent value="task" className={columnStyles}>{overview}{details}</TabsContent>
            <TabsContent value="decompose" forceMount className="data-[state=inactive]:hidden"><DecomposePanel task={current} serious={serious} demo={health.data?.aiMode === "demo"} autorun={autorun} onAutorunHandled={consumeAutorun} /></TabsContent>
            <TabsContent value="update" forceMount className="data-[state=inactive]:hidden"><StatusUpdatePanel task={current} serious={serious} demo={health.data?.aiMode === "demo"} /></TabsContent>
          </Tabs>
        )}
      </main>
      {dialog && current && (
        <TaskDialogs dialog={dialog} serious={serious} onClose={() => setDialog(undefined)}
          onDeleted={() => router.push("/")} />
      )}
    </>
  );
};
