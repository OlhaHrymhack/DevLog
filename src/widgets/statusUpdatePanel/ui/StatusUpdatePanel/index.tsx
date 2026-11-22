"use client";

import { Copy, Info, MessageSquare, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { AgentRunPanel, StatusUpdateSchema, useAgentRun, type StatusUpdateRequestedTone } from "@/entities/agentRun";
import { SlackPreview, ToneSelector, useCopyText, useTypewriter } from "@/features/generateStatusUpdate";
import { Alert, AlertDescription } from "@/shared/ui/Alert";
import { Button } from "@/shared/ui/Button";
import { actionsStyles, hintStyles, mutedStyles } from "./styles";
import type { StatusUpdatePanelProps } from "./types";

/** Панель агента C «Статус-апдейт»: вибір тону, чернетка в стилі Slack, друк, «Скопіювати». Нічого не надсилає. */
export const StatusUpdatePanel = ({ task, serious, demo = false }: StatusUpdatePanelProps) => {
  const { run, start, stop, dismiss } = useAgentRun("status-update");
  const [chosen, setChosen] = useState<StatusUpdateRequestedTone>("auto");
  const copy = useCopyText(serious);
  const tone = serious && chosen === "humor" ? "auto" : chosen;

  const parsed = run.status === "result" || run.status === "fallback" ? StatusUpdateSchema.safeParse(run.data) : null;
  const update = parsed?.success ? parsed.data : null;
  const { shown, typing } = useTypewriter(update?.text ?? "", run.status === "result");

  const generate = (next: StatusUpdateRequestedTone = tone) => void start({ taskId: task.id, tone: next, serious });
  const pick = (next: StatusUpdateRequestedTone) => {
    setChosen(next);
    if (update) generate(next);
  };

  const idle = (
    <>
      <p className={mutedStyles}>
        Агент складе коротке повідомлення у стилі Slack із задачі, підзадач і нотаток. Тон підбере за контекстом:
        є ризик чи дедлайн, отже пише для менеджера.
      </p>
      <ToneSelector value={tone} serious={serious} onChange={pick} />
      <Button className="w-full" onClick={() => generate()}>
        <Sparkles aria-hidden="true" className="size-4" />
        Згенерувати апдейт
      </Button>
    </>
  );

  return (
    <AgentRunPanel title="Статус-апдейт" icon={<MessageSquare aria-hidden="true" className="size-[18px]" />} tagLabel="Агент C"
      run={run} onStop={stop} demo={demo} idle={idle}
      fallbackTitle="Чернетку агента відхилено."
      fallbackMessage="Вона не пройшла перевірку фактів. Нижче короткий шаблонний апдейт без AI."
    >
      {update ? (
        <>
          {update.thin ? (
            <Alert>
              <Info aria-hidden="true" />
              <AlertDescription>Даних мало: немає підзадач і нотаток. Додайте нотатку, і апдейт буде точнішим.</AlertDescription>
            </Alert>
          ) : null}
          <ToneSelector value={tone} resolved={update.tone} serious={serious} onChange={pick} />
          <SlackPreview text={shown} typing={typing} />
          <div className={actionsStyles}>
            <Button className="grow" disabled={typing} onClick={() => void copy(update.text)}>
              <Copy aria-hidden="true" className="size-4" />
              Скопіювати
            </Button>
            <Button variant="ghost" size="icon" aria-label="Перегенерувати апдейт" onClick={() => generate()}>
              <RefreshCw aria-hidden="true" className="size-4" />
            </Button>
          </div>
          <p className={hintStyles}>Агент нічого не надсилає сам: скопіюйте й вставте в Slack.</p>
          <Button variant="ghost" size="sm" className="self-start" onClick={dismiss}>Відхилити</Button>
        </>
      ) : null}
      {run.status === "error" ? <Button className="self-start" onClick={() => generate()}>Спробувати ще раз</Button> : null}
    </AgentRunPanel>
  );
};
