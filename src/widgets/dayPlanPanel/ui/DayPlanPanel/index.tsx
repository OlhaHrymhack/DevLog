"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Sparkles, Target } from "lucide-react";
import { useState } from "react";
import { AgentRunPanel, useAgentRun } from "@/entities/agentRun";
import { taskApi, taskQueryKeys } from "@/entities/task";
import { FocusConfirmDialog } from "@/features/prioritizeTasks";
import { plural } from "@/shared/lib/plural";
import { Button } from "@/shared/ui/Button";
import { Skeleton } from "@/shared/ui/Skeleton";
import { resolvePlan } from "../../lib/resolvePlan";
import { PlanList } from "../PlanList";
import { actionsStyles, hintStyles, mutedStyles, noteLabelStyles, noteStyles, skeletonStyles } from "./styles";
import type { DayPlanPanelProps } from "./types";

const IDLE_SUMMARY = "Пропонує, з чого почати день, і пояснює чому";

/** Панель агента A «План на день»: запуск, кроки, план з поясненнями, fallback за правилом і закріплення фокусу дня. */
export const DayPlanPanel = ({ serious, demo = false }: DayPlanPanelProps) => {
  const { run, start, stop, reset, dismiss } = useAgentRun("prioritize");
  const [confirming, setConfirming] = useState(false);
  const list = useQuery({ queryKey: taskQueryKeys.list(), queryFn: ({ signal }) => taskApi.list({}, signal) });

  const tasks = list.data ?? [];
  const activeCount = tasks.filter((task) => task.status !== "done").length;
  const pinned = tasks.filter((task) => task.focusRank !== null).sort((a, b) => (a.focusRank ?? 0) - (b.focusRank ?? 0));
  const fromRule = run.status === "fallback";
  const plan = run.status === "result" || fromRule ? resolvePlan(run.data, tasks, { fromRule, serious }) : null;
  const runPlan = () => void start({ serious });

  const summary = run.status === "running" ? "Агент працює…"
    : run.status === "result" && plan ? `План готовий: ${plan.items.length} ${plural(plan.items.length, "задача", "задачі", "задач")}`
      : fromRule ? "Агент не впорався, показано порядок за правилом"
        : IDLE_SUMMARY;

  const idle = list.isPending ? (
    <>
      <div className={skeletonStyles} aria-hidden="true">
        <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-3/5" />
      </div>
      <p className={hintStyles}>Чекаю, поки завантажаться задачі…</p>
    </>
  ) : list.isError ? (
    <p className={mutedStyles}>Агенту немає з чим працювати: список задач не завантажився.</p>
  ) : activeCount === 0 ? (
    <p className={mutedStyles}>Немає активних задач для аналізу.{serious ? "" : " Підозріло спокійно 🧘"}</p>
  ) : (
    <>
      <p className={mutedStyles}>
        Агент подивиться на всі активні задачі, зважить пріоритет, вік, статус і дедлайни та запропонує порядок на сьогодні.
        Нічого не змінить без вашого підтвердження.
      </p>
      {pinned.length > 0 && (
        <p className={noteStyles}>
          <span className={noteLabelStyles}>Фокус дня закріплено:</span>{" "}
          {pinned.map((task, index) => `${index + 1}. ${task.title}`).join(" · ")}
        </p>
      )}
      <Button className="w-full" onClick={runPlan}>
        <Sparkles aria-hidden="true" className="size-4" />
        Скласти план на день
      </Button>
    </>
  );

  return (
    <>
      <AgentRunPanel title="План на день" icon={<Target aria-hidden="true" className="size-[18px]" />} tagLabel="Агент A"
        run={run} onStop={stop} demo={demo} collapsible summary={summary} idle={idle}
        fallbackTitle="Відповідь агента відхилено."
        fallbackMessage="Вона не пройшла перевірку двічі, тому не показуємо її."
      >
        {run.status === "result" && plan && plan.items.length > 0 && (
          <>
            <PlanList entries={plan.items} />
            {plan.deferred.length > 0 && (
              <p className={noteStyles}>
                <span className={noteLabelStyles}>Відкладено:</span>{" "}
                {plan.deferred.map((entry) => `${entry.title} (${entry.reason})`).join(", ")}
              </p>
            )}
            <div className={actionsStyles}>
              <Button className="grow" onClick={() => setConfirming(true)}>Застосувати порядок</Button>
              <Button variant="ghost" size="icon" aria-label="Перегенерувати план" onClick={runPlan}>
                <RefreshCw aria-hidden="true" className="size-4" />
              </Button>
            </div>
            <p className={hintStyles}>Це пропозиція: фокус дня зміниться лише після підтвердження.</p>
            <Button variant="ghost" size="sm" className="self-start" onClick={dismiss}>Відхилити</Button>
          </>
        )}
        {fromRule && plan && plan.items.length > 0 && (
          <>
            <p className={mutedStyles}>Порядок за простим правилом: пріоритет → вік → статус. Без пояснень від AI.</p>
            <PlanList entries={plan.items} />
            <div className={actionsStyles}>
              <Button className="grow" onClick={runPlan}>
                <RefreshCw aria-hidden="true" className="size-4" />
                Спробувати ще раз
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(true)}>Взяти цей порядок</Button>
            </div>
          </>
        )}
        {(run.status === "result" || fromRule) && (!plan || plan.items.length === 0) && (
          <>
            <p className={mutedStyles}>Задач із плану вже немає в списку.</p>
            <Button className="self-start" onClick={reset}>Скинути</Button>
          </>
        )}
        {run.status === "error" &&<Button className="self-start" onClick={runPlan}>Спробувати ще раз</Button>}
      </AgentRunPanel>
      {confirming && plan && (
        <FocusConfirmDialog tasks={plan.items} fromRule={fromRule} serious={serious}
          onClose={() => setConfirming(false)}
          onApplied={() => { setConfirming(false); reset(); }}
        />
      )}
    </>
  );
};
