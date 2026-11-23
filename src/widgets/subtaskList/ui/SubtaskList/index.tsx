import { Sparkles, X } from "lucide-react";
import { getSubtaskProgress } from "../../model/subtaskProgress";
import { Button } from "@/shared/ui/Button";
import { Checkbox } from "@/shared/ui/Checkbox";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Progress } from "@/shared/ui/Progress";
import { aiBadgeStyles, checkStyles, counterStyles, headerStyles, itemStyles, listStyles, progressStyles, sectionStyles, titleStyles } from "./styles";
import type { SubtaskListProps } from "./types";

export const SubtaskList = ({ subtasks, pending, onToggle, onDelete, onDecompose }: SubtaskListProps) => {
  const { done, total, percent } = getSubtaskProgress(subtasks);

  return (
    <section aria-labelledby="subtasks-title" className={sectionStyles}>
      <div className={headerStyles}>
        <h2 id="subtasks-title" className="font-medium text-fg-strong">Підзадачі</h2>
        {total > 0 && <span className={counterStyles}>{done} з {total} готово</span>}
      </div>
      {total === 0 ? (
        <EmptyState emoji="🪜" title="Підзадач ще немає"
          description={onDecompose ? "Агент декомпозиції запропонує план, а ви вирішите, що створити." : undefined}
          action={onDecompose && (
            <Button variant="ai" onClick={onDecompose}>
              <Sparkles aria-hidden="true" className="size-4" /> Розбити з AI
            </Button>
          )}
        />
      ) : (
        <>
          <Progress value={percent} aria-label="Прогрес підзадач" className={progressStyles} />
          <ul className={listStyles}>
            {subtasks.map((subtask) => {
              const isDone = subtask.status === "done";
              return (
                <li key={subtask.id} className={itemStyles}>
                  <span className={checkStyles}>
                    <Checkbox checked={isDone} disabled={pending} aria-label={subtask.title}
                      onCheckedChange={() => onToggle(subtask)} />
                  </span>
                  <span data-done={isDone} className={titleStyles}>{subtask.title}</span>
                  {subtask.source === "ai" && <span className={aiBadgeStyles}>✦ AI</span>}
                  <Button variant="ghost" size="icon" disabled={pending} aria-label={`Видалити підзадачу «${subtask.title}»`}
                    onClick={() => onDelete(subtask)}>
                    <X aria-hidden="true" className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
};
