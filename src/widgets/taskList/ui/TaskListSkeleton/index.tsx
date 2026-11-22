import { Skeleton } from "@/shared/ui/Skeleton";
import { listStyles } from "../TaskList/styles";
import { skeletonRowStyles } from "./styles";

export const TaskListSkeleton = () => (
  <div aria-busy="true" aria-label="Завантаження задач" data-testid="task-list-loading" className={listStyles}>
    {[1, 2, 3, 4, 5, 6].map((row) => (
      <div key={row} className={skeletonRowStyles} aria-hidden="true">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-2 h-3 w-1/3" />
      </div>
    ))}
  </div>
);
