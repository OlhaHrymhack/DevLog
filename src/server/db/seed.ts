import "server-only";
import type { Note, Subtask, Task } from "@/entities/task";
import { MS_PER_DAY, MS_PER_HOUR } from "@/shared/lib/timestamp";
import { createId } from "../tasks/ids";
import type { DevLogDb } from "./client";
import { agentRuns, notes, subtasks, tasks } from "./schema";

type SeedTask = Omit<Task, "focusRank" | "dueAt" | "subtasks" | "notes"> & {
  dueAt?: string;
  subtasks: Pick<Subtask, "title" | "status" | "source">[];
  notes: Pick<Note, "text" | "createdAt">[];
};

const sampleTasks = (now: Date): SeedTask[] => {
  const ago = (days: number) => new Date(now.getTime() - days * MS_PER_DAY).toISOString();
  const sub = (title: string, status: Subtask["status"] = "todo", source: Subtask["source"] = "user") =>
    ({ title, status, source });
  const note = (text: string, days: number) => ({ text, createdAt: ago(days) });
  return [
    { id: "t1", title: "Виправити витік пам’яті у воркері нотифікацій", description: "Після деплою 2.14 RSS воркера росте приблизно на 40 МБ/год. Раз на добу процес падає з OOM, Kubernetes його перезапускає, частина push-нотифікацій губиться.", status: "in-progress", priority: "high", createdAt: ago(6.2), updatedAt: ago(5.1),
      subtasks: [sub("Відтворити витік на staging", "done"), sub("Зняти heap snapshot до і після 2 год роботи", "done")],
      notes: [note("Причина: слухачі на 'message' додаються при кожному reconnect, старі не знімаються. Фікс у PR #318, чекає ревʼю.", 5.1)] },
    { id: "t2", title: "Міграція auth на нові токени", description: "Старі JWT перестають валідуватися завтра. Потрібно перевести сервіс на ротацію refresh-токенів і оновити middleware в API.", status: "todo", priority: "high", createdAt: ago(9.3), updatedAt: ago(9.3), dueAt: new Date(now.getTime() + 20 * MS_PER_HOUR).toISOString(), subtasks: [], notes: [] },
    { id: "t3", title: "Флакі e2e-тест оформлення замовлення", description: "Падає приблизно 1 з 8 запусків у CI, локально не відтворюється.", status: "in-progress", priority: "medium", createdAt: ago(4.4), updatedAt: ago(4.2), subtasks: [], notes: [] },
    { id: "t4", title: "Додати пагінацію в /api/tasks", description: "Cursor-based пагінація, 50 задач на сторінку. Блокує сторінку архіву на фронтенді.", status: "todo", priority: "medium", createdAt: ago(2.1), updatedAt: ago(1.2), subtasks: [], notes: [] },
    { id: "t5", title: "Оновити README з інструкцією запуску", description: "Додати опис .env.example, npm-скриптів і розділ про мок-режим агентів.", status: "todo", priority: "low", createdAt: ago(1.4), updatedAt: ago(1.4), subtasks: [], notes: [] },
    { id: "t6", title: "Налаштувати бекапи SQLite", description: "Щоденний снапшот бази у ./backups, ротація 7 днів.", status: "done", priority: "medium", createdAt: ago(10.5), updatedAt: ago(3),
      subtasks: [sub("Скрипт снапшоту", "done"), sub("Ротація старих файлів", "done")], notes: [note("Перевірено відновлення з бекапу на копії бази.", 3)] },
    { id: "t7", title: "Оновити Next.js до 15", description: "Ми на 13.5, частина залежностей вже не підтримує цю версію. Потрібен апгрейд з переходом на нові кешування fetch.", status: "todo", priority: "high", createdAt: ago(8.6), updatedAt: ago(8.6), subtasks: [], notes: [] },
    { id: "t8", title: "Зробити щось з тестами", description: "Тести погані.", status: "todo", priority: "medium", createdAt: ago(3.5), updatedAt: ago(3.5), subtasks: [], notes: [] },
    { id: "t9", title: "Rate limiting для /api/agents", description: "Обмежити виклики агентів до 20 на хвилину на користувача, щоб не спалити бюджет LLM.", status: "in-progress", priority: "high", createdAt: ago(3.2), updatedAt: ago(0.4),
      subtasks: [sub("Вибрати алгоритм (token bucket)", "done"), sub("Middleware для Next.js API routes"), sub("Повертати 429 з Retry-After")],
      notes: [note("Token bucket в памʼяті процесу. Для кількох інстансів знадобиться Redis, поки не робимо.", 0.4)] },
    { id: "t10", title: "Дашборд метрик агентів", description: "Кількість запусків, середній час, частка відповідей, що не пройшли валідацію.", status: "todo", priority: "low", createdAt: ago(12.2), updatedAt: ago(12.2), subtasks: [], notes: [] },
    { id: "t11", title: "Виправити одруківку в onboarding-листі", description: "«Ласкаво просимо» написано разом у темі листа.", status: "done", priority: "low", createdAt: ago(5.5), updatedAt: ago(4.8), subtasks: [], notes: [] },
    { id: "t12", title: "Логування запитів до LLM", description: "Зберігати промпт, відповідь, токени й латентність кожного виклику агента для дебагу.", status: "in-progress", priority: "medium", createdAt: ago(7.4), updatedAt: ago(6.3),
      subtasks: [sub("Схема таблиці llm_calls", "done"), sub("Обгортка над клієнтом Anthropic"), sub("Маскування персональних даних"), sub("Сторінка перегляду логів")], notes: [] }
  ];
};

export const seedDatabase = (db: DevLogDb, now: Date): number => db.transaction(() => {
  db.delete(agentRuns).run();
  db.delete(tasks).run();
  const fixtures = sampleTasks(now);
  for (const { subtasks: children, notes: taskNotes, ...task } of fixtures) {
    db.insert(tasks).values({ ...task, dueAt: task.dueAt ?? null, focusRank: null }).run();
    if (children.length) {
      db.insert(subtasks).values(children.map((subtask, position) => ({
        ...subtask, id: createId(), taskId: task.id, position,
        createdAt: subtask.status === "done" ? task.updatedAt : task.createdAt,
      }))).run();
    }
    if (taskNotes.length) {
      db.insert(notes).values(taskNotes.map((note) => ({
        ...note, id: createId(), taskId: task.id,
      }))).run();
    }
  }
  return fixtures.length;
}, { behavior: "immediate" });
