import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskApi, taskQueryKeys } from "@/entities/task";

export const useAddNote = (taskId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => taskApi.addNote(taskId, { text }),
    onSuccess: () => client.invalidateQueries({ queryKey: taskQueryKeys.all }),
  });
};
