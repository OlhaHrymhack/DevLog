import { ChevronDown, ChevronsUp, Minus } from "lucide-react";
import { PRIORITY_LABELS } from "../../model/labels";
import type { TaskPriority } from "../../model/types";
import { priorityLabelStyles } from "./styles";
import type { PriorityLabelProps } from "./types";

const PRIORITY_ICONS: Record<TaskPriority, typeof Minus> = {
  high: ChevronsUp,
  medium: Minus,
  low: ChevronDown,
};

export const PriorityLabel = ({ priority }: PriorityLabelProps) => {
  const Icon = PRIORITY_ICONS[priority];
  return (
    <span className={priorityLabelStyles({ priority })}>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {PRIORITY_LABELS[priority]}
    </span>
  );
};
