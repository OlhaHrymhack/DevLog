"use client";

import { useEffect, useState } from "react";
import type { TaskListQuery, TaskStatus } from "@/entities/task";

export const SORT_OPTIONS = {
  "priority-desc": { sort: "priority", order: "desc", label: "Пріоритет: високий → низький" },
  "priority-asc": { sort: "priority", order: "asc", label: "Пріоритет: низький → високий" },
  "date-desc": { sort: "createdAt", order: "desc", label: "Дата: спершу нові" },
  "date-asc": { sort: "createdAt", order: "asc", label: "Дата: спершу старі" },
} as const;

export type SortOption = keyof typeof SORT_OPTIONS;

export const getTaskListQuery = (selected: SortOption, status?: TaskStatus, q?: string): Partial<TaskListQuery> => {
  const { sort, order } = SORT_OPTIONS[selected];
  return { sort, order, status, q: q?.trim() || undefined };
};

export const isSortOption = (value: string): value is SortOption => Object.hasOwn(SORT_OPTIONS, value);

export const useTaskListParams = () => {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<TaskStatus>();
  const [sort, setSort] = useState<SortOption>("priority-desc");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const query = search.trim();
    if (query === debouncedSearch) return;
    const timer = window.setTimeout(() => {
      setPage(1);
      setDebouncedSearch(query);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [search, debouncedSearch]);

  const reset = () => {
    setPage(1);
    setStatus(undefined);
    setSearch("");
    setDebouncedSearch("");
  };

  const changeStatus = (next?: TaskStatus) => {
    setPage(1);
    setStatus(next);
  };

  const changeSort = (next: SortOption) => {
    setPage(1);
    setSort(next);
  };

  const query = getTaskListQuery(sort, status, debouncedSearch);
  return { status, changeStatus, sort, changeSort, search, setSearch, reset, page, setPage, query };
};
