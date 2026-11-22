import { Check } from "lucide-react";
import { STATUS_LABELS } from "../../model/labels";
import { dotStyles, statusBadgeStyles } from "./styles";
import type { StatusBadgeProps } from "./types";

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  return (
    <span className={statusBadgeStyles({ status })}>
      {status === "done" ? <Check aria-hidden="true" className="size-4 shrink-0" /> : <span aria-hidden="true" className={dotStyles({ status })} />}
      {STATUS_LABELS[status]}
    </span>
  );
};
