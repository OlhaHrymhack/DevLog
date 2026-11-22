import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskApi, taskQueryKeys, type TaskUpdateInput } from "@/entities/task";

export const useUpdateTask = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TaskUpdateInput }) => taskApi.update(id, patch),
    onSuccess: (task) => {
      client.setQueryData(taskQueryKeys.detail(task.id), task);
      return client.invalidateQueries({ queryKey: taskQueryKeys.lists() });
    },
  });
};
