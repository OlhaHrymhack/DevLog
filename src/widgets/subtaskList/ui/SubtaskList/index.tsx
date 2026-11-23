import { Sparkles, X } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { SubtaskTitleSchema } from "@/entities/task";
import { useCreateSubtasks } from "@/features/subtaskChange";
import { getSubtaskProgress } from "../../model/subtaskProgress";
import { Button } from "@/shared/ui/Button";
import { Checkbox } from "@/shared/ui/Checkbox";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Input } from "@/shared/ui/Input";
import { Progress } from "@/shared/ui/Progress";
import { aiBadgeStyles, checkStyles, counterStyles, headerStyles, itemStyles, listStyles, progressStyles, sectionStyles, titleStyles } from "./styles";
import type { SubtaskListProps } from "./types";

export const SubtaskList = ({ taskId, subtasks, pending, onToggle, onDelete, onDecompose }: SubtaskListProps) => {
  const { done, total, percent } = getSubtaskProgress(subtasks);
  const fieldId = useId();
  const [title, setTitle] = useState("");
  const createSubtasks = useCreateSubtasks(taskId);

  const addSubtask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = SubtaskTitleSchema.safeParse(title);
    if (!parsed.success || createSubtasks.isPending) return;
    try {
      await createSubtasks.mutateAsync([{ title: parsed.data, source: "user" }]);
      setTitle("");
      toast.success("Підзадачу додано");
    } catch {
      toast.error("Не вдалося додати підзадачу. Спробуйте ще раз");
    }
  };

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
      <form className="space-y-2" onSubmit={(event) => void addSubtask(event)}>
        <label htmlFor={fieldId} className="text-sm text-fg-muted">Нова підзадача</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input id={fieldId} value={title} maxLength={200} disabled={createSubtasks.isPending}
            onChange={(event) => setTitle(event.currentTarget.value)} />
          <Button type="submit" disabled={!title.trim() || createSubtasks.isPending}>Додати підзадачу</Button>
        </div>
      </form>
    </section>
  );
};
