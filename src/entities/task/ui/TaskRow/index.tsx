import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { formatDate } from "@/shared/lib/formatDate";
import { ageLabel } from "@/shared/lib/ageLabel";
import { Button } from "@/shared/ui/Button";
import { getHeat } from "../../model/getHeat";
import { HeatBadge } from "../HeatBadge";
import { PriorityLabel } from "../PriorityLabel";
import { StatusBadge } from "../StatusBadge";
import {
  actionsCellStyles,
  ageCellStyles,
  descriptionStyles,
  focusPinStyles,
  heatCellStyles,
  linkStyles,
  metaCellStyles,
  taskRowStyles,
  titleCellStyles,
} from "./styles";
import type { TaskRowProps } from "./types";

/** Один компонент: рядок таблиці ≥ 1024px, картка < 1024px. */
export const TaskRow = ({ task, now, focusRank, serious = false, tableRow = false, onEdit, onDelete }: TaskRowProps) => {
  const heat = getHeat(task, now);
  const isDone = task.status === "done";
  const cell = tableRow ? "cell" : undefined;

  return (
    <div role={tableRow ? "row" : undefined} data-slot="task-row" data-heat={heat.key} className={taskRowStyles({ alarm: heat.key === "alarm" })}>
      <div role={cell} className={titleCellStyles}>
        <Link href={`/tasks/${task.id}`} className={linkStyles({ done: isDone })}>
          {task.title}
        </Link>
        {focusRank === undefined ? null : <span className={focusPinStyles}>Фокус #{focusRank}</span>}
        <p className={descriptionStyles}>{task.description}</p>
      </div>
      <div className={metaCellStyles}>
        <div role={cell}><StatusBadge status={task.status} /></div>
        <div role={cell}><PriorityLabel priority={task.priority} /></div>
      </div>
      <div role={cell} className={cn(ageCellStyles, heat.rank >= 2 ? "text-priority-high" : "text-fg-dim")} title={`Створено ${formatDate(task.createdAt)}`}>{ageLabel(task.createdAt, now)}</div>
      <div role={cell} className={heatCellStyles}>
        <HeatBadge level={heat} serious={serious} />
      </div>
      <div role={cell} className={actionsCellStyles}>
        <Button variant="ghost" size="icon" aria-label={`Редагувати: ${task.title}`} className="size-[44px] min-h-[44px] border-transparent text-fg-muted lg:size-9 lg:min-h-9" disabled={!onEdit} onClick={() => onEdit?.(task)}>
          <Pencil aria-hidden="true" className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label={`Видалити: ${task.title}`} className="size-[44px] min-h-[44px] border-transparent text-fg-muted lg:size-9 lg:min-h-9" disabled={!onDelete} onClick={() => onDelete?.(task)}>
          <Trash2 aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </div>
  );
};
