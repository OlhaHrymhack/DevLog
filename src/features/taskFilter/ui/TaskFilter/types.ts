import type { TaskStatus } from "@/entities/task";

export type TaskCounts = Record<TaskStatus | "all", number>;

export type TaskFilterProps = {
  status?: TaskStatus;
  counts?: TaskCounts;
  onChange: (status?: TaskStatus) => void;
};
