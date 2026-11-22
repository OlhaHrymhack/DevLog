"use client";

import { CircleHelp, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { STATUS_LABELS, useTaskPage, type TaskRowData } from "@/entities/task";
import { HeatLegendDialog } from "@/features/heatLegend";
import { setSerious, useSerious } from "@/features/seriousMode";
import { TaskFilter } from "@/features/taskFilter";
import { TaskSearch } from "@/features/taskSearch";
import { TaskSort } from "@/features/taskSort";
import { useHealth } from "@/shared/api/health/useHealth";
import { setForceInvalidOutput, useForceInvalidOutput } from "@/shared/lib/hooks/useForceInvalidOutput";
import { useHotkeys } from "@/shared/lib/hooks/useHotkeys";
import { Button } from "@/shared/ui/Button";
import { Pagination } from "@/shared/ui/Pagination";
import { EmptyState } from "@/shared/ui/EmptyState";
import { AppHeader } from "@/widgets/appHeader";
import { DemoModeBanner } from "@/widgets/demoModeBanner";
import { DevStatesPanel, type ModeOverride, type ScreenOverride } from "@/widgets/devStatesPanel";
import { TaskList, TaskListSkeleton } from "@/widgets/taskList";
import { t } from "../../model/copy.uk";
import { formatTaskSummary } from "../../model/formatTaskSummary";
import { isSortOption, SORT_OPTIONS, useTaskListParams } from "../../model/useTaskListParams";
import { fabStyles, filtersStyles, layoutStyles, mainStyles, skipLinkStyles, titleStyles } from "./styles";
import { TaskDialogs } from "../TaskDialogs";
import type { TaskDialog } from "../TaskDialogs/types";

const sortOptions = Object.entries(SORT_OPTIONS).map(([value, { label }]) => ({ value, label }));
const EMPTY_SUMMARY = { all: 0, todo: 0, "in-progress": 0, done: 0, hot: 0 };
const isDevelopment = process.env.NODE_ENV !== "production";

export const TasksListView = () => {
  const filters = useTaskListParams();
  const search = useRef<HTMLInputElement>(null);
  const [now] = useState(() => Date.now());
  const [legendOpen, setLegendOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [screen, setScreen] = useState<ScreenOverride>("real");
  const [mode, setMode] = useState<ModeOverride>("auto");
  const invalidOutput = useForceInvalidOutput();
  const serious = useSerious();
  const [taskDialog, setTaskDialog] = useState<TaskDialog>();
  const onNewTask = () => setTaskDialog({ kind: "create" });
  const onEdit = (task: TaskRowData) => setTaskDialog({ kind: "edit", task });
  const onDelete = (task: TaskRowData) => setTaskDialog({ kind: "delete", task });

  useHotkeys(() => search.current?.focus(), onNewTask, legendOpen || devOpen || Boolean(taskDialog));

  const current = useTaskPage({ ...filters.query, page: filters.page });
  const health = useHealth();
  const aiMode = isDevelopment && mode !== "auto" ? mode : health.data?.aiMode;
  const statistics = screen === "empty" ? EMPTY_SUMMARY : current.data?.summary;
  const tasks = screen === "empty" ? [] : current.data?.data ?? [];
  const filteredBy = Boolean(filters.query.status || filters.query.q);
  const pagination = screen === "real" ? current.data?.pagination : undefined;

  const loading = screen === "loading" || (screen === "real" && (current.isPending || current.isPlaceholderData));
  const error = screen === "error" || (screen === "real" && current.isError);
  const showEmpty = !loading && !error && tasks.length === 0;
  const summary = screen === "loading" || (!statistics && current.isPending)
    ? "Завантаження…"
    : (error && !statistics) || screen === "error"
      ? "Не вдалося завантажити"
      : statistics && formatTaskSummary(statistics, serious);

  const retry = async () => {
    if (screen === "error") setScreen("real");
    const result = await current.refetch();
    if (result.isSuccess) toast.success("Задачі завантажено");
  };
  const emptyFilterTitle = filters.query.q
    ? `Нічого не знайдено за запитом «${filters.query.q}»`
    : filters.status ? `Немає задач зі статусом «${STATUS_LABELS[filters.status]}»` : "Нічого не знайдено";

  return (
    <>
      <a href="#main" className={skipLinkStyles}>Перейти до вмісту</a>
      <AppHeader onOpenDevPanel={isDevelopment ? () => setDevOpen(true) : undefined} onNewTask={onNewTask} />
      <DemoModeBanner mode={aiMode} />

      <main id="main" tabIndex={-1} className={mainStyles}>
        <div className={layoutStyles}>
          <div className="min-w-0 [grid-area:head]">
            <h1 className={titleStyles}>Задачі</h1>
            <p className="mt-2 text-sm text-fg-muted" data-testid="task-summary">{summary}</p>
          </div>
          <aside aria-label="AI-агенти" className="hidden [grid-area:aside] lg:sticky lg:top-[84px] lg:block">
            <div id="agent-a" />
            <div id="agent-d" />
          </aside>

          <div className="min-w-0 space-y-5 [grid-area:tasks]">
            <TaskSearch value={filters.search} onChange={filters.setSearch} inputRef={search} />
            <div className={filtersStyles}>
              <TaskFilter status={filters.status} counts={statistics} onChange={filters.changeStatus} />
              <TaskSort value={filters.sort} options={sortOptions} onChange={(value) => {
                if (isSortOption(value)) filters.changeSort(value);
              }} />
              <Button variant="ghost" className="min-h-11" aria-label="Температура задач: легенда" onClick={() => setLegendOpen(true)}>
                <CircleHelp aria-hidden="true" className="size-4" />
                <span className="hidden md:inline">Температура</span>
              </Button>
            </div>

            {loading && <TaskListSkeleton />}
            {error && (
              <EmptyState tone="error" emoji="🔌" title="Не вдалося завантажити задачі"
                description="Сервер не відповів. Спробуйте ще раз."
                action={<Button onClick={() => void retry()} disabled={current.isFetching}>Спробувати ще раз</Button>}
              />
            )}
            {showEmpty && filteredBy && (
              <EmptyState emoji="🔎" title={emptyFilterTitle}
                action={<Button variant="ghost" onClick={filters.reset}>Скинути фільтри</Button>} />
            )}
            {showEmpty && !filteredBy && (
              <EmptyState tone={serious ? "neutral" : "humor"} emoji={serious ? "📋" : "🧘"}
                title={t("emptyTitle", serious)} description={t("emptyDescription", serious)}
                action={<Button onClick={onNewTask}>Нова задача</Button>}
              />
            )}
            {!loading && !error && tasks.length > 0 && (
              <TaskList tasks={tasks} now={now} serious={serious} onEdit={onEdit} onDelete={onDelete} />
            )}
            {pagination && pagination.totalPages > 1 && !error && (
              <Pagination label="Сторінки задач" page={pagination.page} totalPages={pagination.totalPages}
                pending={loading} onPageChange={filters.setPage} />
            )}
          </div>
        </div>
      </main>

      <Button size="icon" className={fabStyles} aria-label="Нова задача" onClick={onNewTask}>
        <Plus aria-hidden="true" className="size-6" />
      </Button>
      {taskDialog && (
        <TaskDialogs dialog={taskDialog} serious={serious} onClose={() => setTaskDialog(undefined)}
          onCreated={() => { if (screen === "empty") setScreen("real"); }}
        />
      )}
      <HeatLegendDialog open={legendOpen} onOpenChange={setLegendOpen} serious={serious} />
      <DevStatesPanel open={devOpen} onOpenChange={setDevOpen} screen={screen} onScreenChange={setScreen}
        mode={mode} onModeChange={setMode} serious={serious} onSeriousChange={setSerious}
        invalidOutput={invalidOutput} onInvalidOutputChange={setForceInvalidOutput}
      />
    </>
  );
};
