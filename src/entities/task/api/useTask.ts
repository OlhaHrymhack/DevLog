"use client";

import { useQuery } from "@tanstack/react-query";
import { taskApi, taskQueryKeys } from "./taskApi";

export const useTask = (id: string) =>
  useQuery({
    queryKey: taskQueryKeys.detail(id),
    queryFn: ({ signal }) => taskApi.get(id, signal),
  });
