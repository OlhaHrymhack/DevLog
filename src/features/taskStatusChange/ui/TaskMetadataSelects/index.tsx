import { ChevronDown } from "lucide-react";
import { PRIORITY_LABELS, STATUS_LABELS, TaskPrioritySchema, TaskStatusSchema } from "@/entities/task";
import { cn } from "@/shared/lib/cn";
import { arrowStyles, pillStyles, priorityStyles, selectStyles, statusStyles } from "./styles";
import type { TaskMetadataSelectsProps } from "./types";

const PRIORITY_ORDER = ["high", "medium", "low"] as const;

export const TaskMetadataSelects = ({ status, priority, pending, onStatusChange, onPriorityChange }: TaskMetadataSelectsProps) => (
  <>
    <div className={cn(pillStyles, statusStyles[status], "rounded-full")}>
      <select aria-label="Статус" className={cn(selectStyles, statusStyles[status])} disabled={pending} value={status}
        onChange={({ currentTarget }) => {
          const next = TaskStatusSchema.safeParse(currentTarget.value);
          if (next.success) onStatusChange(next.data);
        }}
      >
        {TaskStatusSchema.options.map((item) => <option key={item} value={item}>{STATUS_LABELS[item]}</option>)}
      </select>
      <ChevronDown aria-hidden="true" className={arrowStyles} />
    </div>
    <div className={cn(pillStyles, priorityStyles[priority])}>
      <select aria-label="Пріоритет" className={cn(selectStyles, "bg-surface-raised")} disabled={pending} value={priority}
        onChange={({ currentTarget }) => {
          const next = TaskPrioritySchema.safeParse(currentTarget.value);
          if (next.success) onPriorityChange(next.data);
        }}
      >
        {PRIORITY_ORDER.map((item) => <option key={item} value={item}>{PRIORITY_LABELS[item]} пріоритет</option>)}
      </select>
      <ChevronDown aria-hidden="true" className={arrowStyles} />
    </div>
  </>
);
