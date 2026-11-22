import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskApi, taskQueryKeys } from "@/entities/task";

/** Закріплення фокусу дня: `PUT /api/tasks/focus` замінює попередній фокус; кеш списків оновлюється. */
export const useApplyFocus = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (taskIds: string[]) => taskApi.setFocus({ taskIds }),
    onSuccess: () => client.invalidateQueries({ queryKey: taskQueryKeys.lists() }),
  });
};
