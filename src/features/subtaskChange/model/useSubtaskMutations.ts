import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskApi, taskQueryKeys, type SubtaskStatus } from "@/entities/task";

type SubtaskRef = { taskId: string; subtaskId: string };

export const useSetSubtaskStatus = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, subtaskId, status }: SubtaskRef & { status: SubtaskStatus }) =>
      taskApi.updateSubtask(taskId, subtaskId, { status }),
    onSuccess: () => client.invalidateQueries({ queryKey: taskQueryKeys.all }),
  });
};

export const useDeleteSubtask = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, subtaskId }: SubtaskRef) => taskApi.deleteSubtask(taskId, subtaskId),
    onSuccess: () => client.invalidateQueries({ queryKey: taskQueryKeys.all }),
  });
};
