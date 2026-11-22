import type { TaskRowData } from "@/entities/task";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Фіксований «зараз» каталогу — рендер детермінований (SSR і тести). */
export const UI_KIT_NOW = Date.UTC(2026, 10, 21, 12, 0);

const ago = (days: number): string => {
  return new Date(UI_KIT_NOW - days * DAY).toISOString();
};

/** По одній задачі на кожен рівень температури. */
export const SAMPLE_TASKS: readonly TaskRowData[] = [
  { id: "ui-fresh", title: "Додати пагінацію в /api/tasks", description: "Cursor-based пагінація, 50 задач на сторінку.", status: "todo", priority: "medium", createdAt: ago(2), updatedAt: ago(1) },
  { id: "ui-calm", title: "Оновити README з інструкцією запуску", description: "Додати опис змінних середовища, npm-скриптів і мок-режиму агентів.", status: "todo", priority: "low", createdAt: ago(1), updatedAt: ago(1) },
  { id: "ui-done", title: "Налаштувати бекапи SQLite", description: "Щоденний снапшот бази у ./backups, ротація 7 днів.", status: "done", priority: "medium", createdAt: ago(10), updatedAt: ago(3) },
  { id: "ui-warm", title: "Флакі e2e-тест оформлення замовлення", description: "Падає приблизно 1 з 8 запусків у CI, локально не відтворюється.", status: "in-progress", priority: "medium", createdAt: ago(4), updatedAt: ago(4) },
  { id: "ui-hot", title: "Виправити витік пам’яті у воркері нотифікацій", description: "Після деплою 2.14 RSS воркера росте приблизно на 40 МБ/год.", status: "in-progress", priority: "high", createdAt: ago(6), updatedAt: ago(5) },
  { id: "ui-fire", title: "Оновити Next.js до 15", description: "Частина залежностей вже не підтримує поточну версію.", status: "todo", priority: "high", createdAt: ago(9), updatedAt: ago(8) },
  { id: "ui-alarm", title: "Міграція auth на нові токени", description: "Старі JWT перестають валідуватися завтра.", status: "todo", priority: "high", createdAt: ago(9), updatedAt: ago(9), dueAt: new Date(UI_KIT_NOW + 20 * HOUR).toISOString() },
];
