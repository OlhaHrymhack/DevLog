"use client";

import { useQuery } from "@tanstack/react-query";
import { Radar, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AgentRunPanel, STUCK_ACTION_LABELS, useAgentRun, type StuckAction, type TriageItem } from "@/entities/agentRun";
import { taskApi, taskQueryKeys } from "@/entities/task";
import { DraftMessageDialog, snoozeToast, StuckTaskCard, useSnoozedIds } from "@/features/detectStuckTasks";
import { Button } from "@/shared/ui/Button";
import { resolveCards } from "../../lib/resolveCards";
import { bigStyles, emptyStyles, mutedStyles } from "./styles";
import type { StuckRadarPanelProps } from "./types";

const IDLE_SUMMARY = "Шукає задачі, що застрягли «в роботі»";

/** Панель агента D «Радар застряглих»: пошук, діагноз, дії на картках, чернетки, «Ігнорувати» до перезавантаження. */
export const StuckRadarPanel = ({ serious, demo = false }: StuckRadarPanelProps) => {
  const { run, start, stop } = useAgentRun("stuck-radar");
  const { snoozedIds, snooze } = useSnoozedIds();
  const router = useRouter();
  const [draft, setDraft] = useState<{ title: string; text: string } | null>(null);
  const list = useQuery({ queryKey: taskQueryKeys.list(), queryFn: ({ signal }) => taskApi.list({}, signal) });

  const finished = run.status === "result" || run.status === "fallback";
  const cards = finished ? resolveCards(run.data, list.data ?? [], snoozedIds, new Date()) : [];
  const scan = () => void start({ snoozedIds: [...snoozedIds], serious });

  const summary = run.status === "running" ? "Сканую…"
    : finished ? (cards.length ? `Знайдено застряглих: ${cards.length}` : "Нічого не застрягло")
      : IDLE_SUMMARY;

  const act = (action: StuckAction, item: TriageItem) => {
    if (action === "split") router.push(`/tasks/${item.taskId}?tab=decompose&autorun=1`);
    else if (action === "open") router.push(`/tasks/${item.taskId}`);
    else if (item.draft) setDraft({ title: STUCK_ACTION_LABELS[action], text: item.draft });
  };
  const ignore = (taskId: string) => {
    snooze(taskId);
    toast(snoozeToast(serious));
  };

  const idle = (
    <>
      <p className={mutedStyles}>
        Агент знаходить задачі, які давно не рухаються, з’ясовує ймовірну причину (розмита, завелика, чекає ревʼю) і пропонує дію.
      </p>
      <Button className="w-full" onClick={scan}>
        <Radar aria-hidden="true" className="size-4" />
        Просканувати
      </Button>
    </>
  );

  return (
    <>
      <AgentRunPanel title="Радар застряглих" icon={<Radar aria-hidden="true" className="size-[18px]" />} tagLabel="Агент D"
        run={run} onStop={stop} demo={demo} collapsible summary={summary} idle={idle}
        fallbackTitle="Пропозиції агента відхилено."
        fallbackMessage="Показую лише знайдені задачі без порад."
      >
        {finished && cards.map((card) => (
          <StuckTaskCard key={card.item.taskId} {...card} serious={serious} onAct={act} onSnooze={ignore} />
        ))}
        {finished && cards.length === 0 && (
          <div className={emptyStyles}>
            <span className={bigStyles} aria-hidden="true">🧘</span>
            <p className={mutedStyles}>{serious ? "Застряглих задач немає." : "Нічого не застрягло. Або все під контролем, або ти забув оновити статуси."}</p>
          </div>
        )}
        {finished && (
          <Button variant="ghost" size="sm" className="self-start" onClick={scan}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Сканувати ще раз
          </Button>
        )}
        {run.status === "error" && <Button className="self-start" onClick={scan}>Спробувати ще раз</Button>}
      </AgentRunPanel>
      {draft && <DraftMessageDialog title={draft.title} draft={draft.text} onClose={() => setDraft(null)} />}
    </>
  );
};
