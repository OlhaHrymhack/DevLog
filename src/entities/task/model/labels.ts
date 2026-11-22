import type { TaskPriority, TaskStatus } from "./types";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "До роботи",
  "in-progress": "В роботі",
  done: "Готово",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "Високий",
  medium: "Середній",
  low: "Низький",
};
