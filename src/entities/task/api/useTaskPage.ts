"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { taskApi, taskQueryKeys } from "./taskApi";
import type { TaskPageQuery } from "./contracts";

export const useTaskPage = (query: Partial<TaskPageQuery>) =>
  useQuery({
    queryKey: taskQueryKeys.page(query),
    queryFn: ({ signal }) => taskApi.listPage(query, signal),
    placeholderData: keepPreviousData,
  });
