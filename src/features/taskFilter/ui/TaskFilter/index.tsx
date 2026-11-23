import { STATUS_LABELS, TaskStatusSchema } from "@/entities/task";
import { cn } from "@/shared/lib/cn";
import type { TaskFilterProps } from "./types";
import { filterGroupStyles, filterButtonStyles, selectedStyles, unselectedStyles } from "./styles";

export const TaskFilter = ({ status, counts, onChange }: TaskFilterProps) => (
  <div role="group" aria-label="Фільтр за статусом" className={filterGroupStyles}>
    {(["all", ...TaskStatusSchema.options] as const).map((value) => {
      const selected = (status ?? "all") === value;
      return (
        <button
          key={value}
          type="button"
          aria-pressed={selected}
          onClick={() => onChange(value === "all" ? undefined : value)}
          className={cn(filterButtonStyles, selected ? selectedStyles : unselectedStyles)}
        >
          {value === "all" ? "Всі" : STATUS_LABELS[value]} {counts && <span className="opacity-70">{counts[value]}</span>}
        </button>
      );
    })}
  </div>
);
