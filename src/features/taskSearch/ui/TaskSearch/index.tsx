import { Search } from "lucide-react";
import type { TaskSearchProps } from "./types";
import { searchFieldStyles, searchInputStyles, shortcutStyles } from "./styles";

export const TaskSearch = ({ value, onChange, inputRef }: TaskSearchProps) => (
  <label className={searchFieldStyles}>
    <Search className="size-4 shrink-0" aria-hidden="true" />
    <span className="sr-only">Пошук задач</span>
    <input
      ref={inputRef}
      type="search"
      className={searchInputStyles}
      placeholder="Пошук задач…"
      autoComplete="off"
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
    <kbd aria-hidden="true" className={shortcutStyles}>/</kbd>
  </label>
);
