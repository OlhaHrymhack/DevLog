"use client";

import { Check, Info, ListTree, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AgentRunPanel, DecompositionSchema, useAgentRun, type DecompositionItem } from "@/entities/agentRun";
import { isVague } from "@/entities/task";
import { clarificationNote, ClarifyForm, SubtaskSuggestions } from "@/features/decomposeTask";
import { useAddNote } from "@/features/noteAdd";
import { useCreateSubtasks } from "@/features/subtaskChange";
import { plural } from "@/shared/lib/plural";
import { Alert, AlertDescription } from "@/shared/ui/Alert";
import { Button } from "@/shared/ui/Button";
import { mutedStyles } from "./styles";
import type { DecomposePanelProps } from "./types";

const countLabel = (count: number): string => `${count} ${plural(count, "підзадачу", "підзадачі", "підзадач")}`;

/** Панель агента B «Декомпозиція»: запуск, уточнення, пропозиції з чекбоксами й створення обраних підзадач. */
export const DecomposePanel = ({ task, serious, demo = false, autorun = false, onAutorunHandled }: DecomposePanelProps) => {
  const { run, start, stop, reset, markApplied } = useAgentRun("decompose");
  const addNote = useAddNote(task.id);
  const createSubtasks = useCreateSubtasks(task.id);
  const [created, setCreated] = useState(0);

  const startRun = (clarification?: string) => void start({ taskId: task.id, serious, ...(clarification ? { clarification } : {}) });

  // Відкладений запуск дає StrictMode скасувати перший ефект до надсилання запиту з квотою.
  useEffect(() => {
    if (!autorun) return;
    const timeout = window.setTimeout(() => {
      void start({ taskId: task.id, serious });
      onAutorunHandled?.();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [autorun, onAutorunHandled, serious, start, task.id]);

  const decided = run.status === "result" || run.status === "fallback" || run.status === "clarify";
  const parsed = decided ? DecompositionSchema.safeParse(run.data) : null;
  const decomposition = parsed?.success ? parsed.data : null;

  const answer = async (text: string) => {
    try {
      await addNote.mutateAsync(clarificationNote(text));
    } catch {
      toast.error("Не вдалося зберегти уточнення. Спробуйте ще раз");
      return;
    }
    startRun(text);
  };

  const create = async (items: DecompositionItem[]) => {
    try {
      await createSubtasks.mutateAsync(items.map(({ title, estimate, rationale }) => ({ title, source: "ai", estimate, rationale })));
    } catch {
      toast.error("Не вдалося створити підзадачі. Спробуйте ще раз");
      return;
    }
    setCreated(items.length);
    toast.success(`Створено ${countLabel(items.length)}`);
    markApplied();
  };

  const idle = (
    <>
      <p className={mutedStyles}>
        Агент розіб’є задачу на 3–6 підзадач з оцінкою часу. Якщо задача нечітка, спершу поставить уточнювальні питання.
        Підзадачі з’являться лише після підтвердження.
      </p>
      {isVague(task) ? (
        <Alert>
          <Info aria-hidden="true" />
          <AlertDescription>Опис короткий: агент, найімовірніше, попросить уточнення.</AlertDescription>
        </Alert>
      ) : null}
      <Button className="w-full" onClick={() => startRun()}>
        <ListTree aria-hidden="true" className="size-4" />
        Розбити на підзадачі
      </Button>
    </>
  );

  return (
    <AgentRunPanel title="Декомпозиція" icon={<ListTree aria-hidden="true" className="size-[18px]" />} tagLabel="Агент B"
      run={run} onStop={stop} demo={demo} idle={idle}
      fallbackTitle="Відповідь агента відхилено."
      fallbackMessage="Пропонуємо базовий шаблон без AI. Його можна відредагувати після створення."
    >
      {decided && !decomposition ? (
        <>
          <p className={mutedStyles}>Не вдалося прочитати відповідь агента.</p>
          <Button className="self-start" onClick={reset}>Скинути</Button>
        </>
      ) : null}
      {decomposition?.kind === "clarify" ? (
        <ClarifyForm key={run.runId} questions={decomposition.questions} serious={serious} pending={addNote.isPending} onSubmit={(text) => void answer(text)} onCancel={reset} />
      ) : null}
      {decomposition?.kind === "subtasks" ? (
        <SubtaskSuggestions key={run.runId} items={decomposition.items} pending={createSubtasks.isPending}
          onCreate={(items) => void create(items)} onCancel={reset} />
      ) : null}
      {run.status === "applied" ? (
        <>
          <Alert>
            <Check aria-hidden="true" />
            <AlertDescription>
              Створено {countLabel(created)}. {serious ? "" : "План є, тепер лишилось його виконати 😅"}
            </AlertDescription>
          </Alert>
          <Button variant="ghost" className="self-start" onClick={() => startRun()}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Розбити ще раз
          </Button>
        </>
      ) : null}
      {run.status === "error" ? <Button className="self-start" onClick={() => startRun()}>Спробувати ще раз</Button> : null}
    </AgentRunPanel>
  );
};
