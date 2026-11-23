import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { DecompositionItem } from "@/entities/agentRun";
import { taskApi, taskQueryKeys } from "@/entities/task";

/** Створення обраних підзадач агента: `POST /api/tasks/:id/subtasks` з `source: "ai"`; кеш задач оновлюється. */
export const useCreateSubtasks = (taskId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (items: readonly DecompositionItem[]) => taskApi.addSubtasks(taskId, {
      items: items.map(({ title, estimate, rationale }) => ({ title, source: "ai", estimate, rationale })),
    }),
    onSuccess: () => client.invalidateQueries({ queryKey: taskQueryKeys.all }),
  });
};
