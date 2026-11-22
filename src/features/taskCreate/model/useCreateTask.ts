import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskApi, taskQueryKeys } from "@/entities/task";

export const useCreateTask = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof taskApi.create>[0]) => taskApi.create(input),
    onSuccess: (task) => {
      client.setQueryData(taskQueryKeys.detail(task.id), task);
      return client.invalidateQueries({ queryKey: taskQueryKeys.lists() });
    },
  });
};
