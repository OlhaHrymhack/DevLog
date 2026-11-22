import { getHeat, type HeatKey, type TaskListItem } from "@/entities/task";
import { daysBetween } from "@/shared/lib/daysBetween";
import { MS_PER_HOUR, toMillis } from "@/shared/lib/timestamp";
import { isUrgent, scoreTask } from "./scoreTask";

export type ActiveTaskView = {
  id: string;
  title: string;
  status: TaskListItem["status"];
  priority: TaskListItem["priority"];
  ageDays: number;
  staleDays: number;
  /** Години до дедлайну (від'ємне — прострочено); `null`, якщо дедлайну немає. */
  dueInHours: number | null;
  /** Дедлайн менш ніж за 48 год: така задача обов'язково потрапляє в план. */
  urgent: boolean;
  heat: HeatKey;
  openSubtasks: number;
  score: number;
};

export const isActive = (task: Pick<TaskListItem, "status">): boolean => task.status !== "done";

const roundScore = (score: number): number => Math.round(score * 10) / 10;

/** Подання активної задачі для моделі й mock: чисті обчислення з фіксованим `now`, без запису. */
export const toActiveTaskView = (task: TaskListItem, now: Date): ActiveTaskView => ({
  id: task.id,
  title: task.title,
  status: task.status,
  priority: task.priority,
  ageDays: daysBetween(task.createdAt, now),
  staleDays: daysBetween(task.updatedAt, now),
  dueInHours: task.dueAt == null ? null : Math.round((toMillis(task.dueAt) - now.getTime()) / MS_PER_HOUR),
  urgent: isUrgent(task, now),
  heat: getHeat(task, now).key,
  openSubtasks: task.subtaskCount - task.subtaskDone,
  score: roundScore(scoreTask(task, now)),
});

/** Активні задачі від найвищої ваги: рівна вага зберігає порядок вхідного списку. */
export const rankActiveTasks = (tasks: readonly TaskListItem[], now: Date): TaskListItem[] =>
  tasks.filter(isActive).map((task) => ({ task, score: scoreTask(task, now) }))
    .sort((a, b) => b.score - a.score)
    .map(({ task }) => task);
