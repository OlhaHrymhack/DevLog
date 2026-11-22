import { ArrowDownUp } from "lucide-react";
import type { TaskSortProps } from "./types";
import { sortFieldStyles, sortInputStyles } from "./styles";

export const TaskSort = ({ value, onChange, options }: TaskSortProps) => (
  <label className={sortFieldStyles}>
    <ArrowDownUp aria-hidden="true" className="size-4 shrink-0" />
    <span className="sr-only">Сортування</span>
    <select className={sortInputStyles} value={value} onChange={(event) => onChange(event.currentTarget.value)}>
      {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
    </select>
  </label>
);
