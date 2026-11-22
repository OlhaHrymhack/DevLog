import { Skeleton } from "@/shared/ui/Skeleton";

export const TaskDetailsSkeleton = () => (
  <div aria-busy="true" aria-label="Завантаження задачі" data-testid="task-details-loading" className="space-y-4">
    <Skeleton className="h-9 w-2/3" />
    <Skeleton className="h-8 w-1/2" />
    <Skeleton className="h-32 w-full" />
  </div>
);
