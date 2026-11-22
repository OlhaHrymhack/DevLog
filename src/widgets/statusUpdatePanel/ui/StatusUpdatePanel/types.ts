import type { Task } from "@/entities/task";

export type StatusUpdatePanelProps = {
  task: Task;
  /** Серйозний режим: без жартів і емодзі. */
  serious: boolean;
  /** Режим AI до першої події запуску (з /api/health). */
  demo?: boolean;
};
