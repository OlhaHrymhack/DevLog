import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskApi, taskQueryKeys } from "@/entities/task";

export const useDeleteTask = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: taskApi.delete,
    onSuccess: async (_, id) => {
      client.removeQueries({ queryKey: taskQueryKeys.detail(id), exact: true });
      await client.invalidateQueries({ queryKey: taskQueryKeys.lists() });
    },
  });
};
