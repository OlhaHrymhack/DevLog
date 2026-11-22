import { TASK_TABLE_COLUMNS, TaskRow } from "@/entities/task";
import { cn } from "@/shared/lib/cn";
import { listStyles, tableHeaderStyles } from "./styles";
import type { TaskListProps } from "./types";

const TITLES = ["Задача", "Статус", "Пріоритет", "Вік", "Температура", "Дії"];

export const TaskList = ({ tasks, now, serious, onEdit, onDelete }: TaskListProps) => (
  <div role="table" aria-label="Список задач" data-testid="task-list" className={listStyles}>
    <div role="row" className={cn(tableHeaderStyles, TASK_TABLE_COLUMNS)}>
      {TITLES.map((title) => <span role="columnheader" key={title} aria-label={title}>{title === "Температура" ? "🌶️" : title}</span>)}
    </div>
    {tasks.map((task) => (
      <TaskRow key={task.id} task={task} now={now} serious={serious} tableRow
        focusRank={task.focusRank ?? undefined} onEdit={onEdit} onDelete={onDelete} />
    ))}
  </div>
);
