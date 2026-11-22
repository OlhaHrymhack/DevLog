import type { Task } from "@/entities/task";

export type DecomposePanelProps = {
  task: Task;
  /** Серйозний режим: без жартів і емодзі. */
  serious: boolean;
  /** Режим AI до першої події запуску (з /api/health). */
  demo?: boolean;
  /** Запустити агента одразу (`?autorun=1` або «Розбити з AI»). */
  autorun?: boolean;
  onAutorunHandled?: () => void;
};
