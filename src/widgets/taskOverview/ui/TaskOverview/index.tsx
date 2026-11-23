import { Pencil, Trash2 } from "lucide-react";
import { getHeat, HeatBadge } from "@/entities/task";
import { TaskMetadataSelects } from "@/features/taskStatusChange";
import { ageLabel } from "@/shared/lib/ageLabel";
import { formatDate } from "@/shared/lib/formatDate";
import { Button } from "@/shared/ui/Button";
import { actionsStyles, dateStyles, descriptionCardStyles, descriptionStyles, headingRowStyles, metadataStyles, titleStyles } from "./styles";
import type { TaskOverviewProps } from "./types";

export const TaskOverview = ({ task, serious, now, pending, onEdit, onDelete, onStatusChange, onPriorityChange }: TaskOverviewProps) => {
  const heat = getHeat(task, now);

  return (
    <section aria-labelledby="task-title">
      <div className={headingRowStyles}>
        <h1 id="task-title" className={titleStyles}>{task.title}</h1>
        <div className={actionsStyles}>
          <Button variant="ghost" size="sm" disabled={pending} onClick={onEdit}>
            <Pencil aria-hidden="true" className="size-4" /> Редагувати
          </Button>
          <Button variant="danger-ghost" size="sm" disabled={pending} onClick={onDelete}>
            <Trash2 aria-hidden="true" className="size-4" /> Видалити
          </Button>
        </div>
      </div>
      <div className={metadataStyles}>
        <TaskMetadataSelects status={task.status} priority={task.priority} pending={pending}
          onStatusChange={onStatusChange} onPriorityChange={onPriorityChange} />
        <HeatBadge level={heat} serious={serious} always />
        <span className={dateStyles}>{heat.name}</span>
        <span className={dateStyles}>
          Створено {formatDate(task.createdAt)} · {ageLabel(task.createdAt, now)}
          {task.dueAt && <> · <b className="font-medium text-priority-high">дедлайн {formatDate(task.dueAt)}</b></>}
        </span>
      </div>
      <section className={descriptionCardStyles}>
        <h2 className="font-medium text-fg-strong">Опис</h2>
        <p className={descriptionStyles}>{task.description.trim() || "Опису немає"}</p>
      </section>
    </section>
  );
};
