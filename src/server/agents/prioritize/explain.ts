import type { HeatKey } from "@/entities/task";
import { plural } from "@/shared/lib/plural";
import type { ActiveTaskView } from "./activeTasks";

export const PRIORITY_PHRASES = { high: "високий пріоритет", medium: "середній пріоритет", low: "низький пріоритет" } as const;

/** Слова-ознаки того, що пояснення спирається на фактор: пріоритет, вік, дні без змін, статус або дедлайн. */
export const FACTOR_PATTERN = /пріоритет|вік|дн(?:ів|і|ь|я)|без змін|в роботі|статус|дедлайн/i;

const JOKES_A: Partial<Record<HeatKey, readonly string[]>> = {
  alarm: ["Дедлайн завтра. Час удавати, що так і було задумано 🚒", "Тут уже не перці, тут пожежна команда 🏚️🔥"],
  fire: ["Почни з цієї. Вона висить {d} і вже знає про тебе забагато 🔥", "Ця задача має стаж. Скоро попросить підвищення 🌶️🌶️🌶️"],
  hot: ["Технічно це «high priority». Фактично це «хтось уже пише в лічку» 📞", "Задачу помітив навіть менеджер. Це погано 🌶️🌶️"],
  warm: ["Ще не горить. Просто тліє, як мотивація в понеділок 🌶️"],
};

const STALE_DAYS_FOR_NOTE = 3;

const hashId = (id: string): number => [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);

/** Пояснення з прототипу `explain`: фактори через кому з крапкою в кінці. */
export const explainTask = (view: ActiveTaskView): string => {
  const parts: string[] = [];
  if (view.urgent && view.dueInHours !== null) {
    parts.push(view.dueInHours < 24 ? "дедлайн менш ніж за добу" : "дедлайн менш ніж за дві доби");
  }
  parts.push(PRIORITY_PHRASES[view.priority]);
  if (view.status === "in-progress") parts.push("уже в роботі: закінчити дешевше, ніж перемикатися");
  parts.push(view.staleDays >= STALE_DAYS_FOR_NOTE
    ? `${view.staleDays} ${plural(view.staleDays, "день", "дні", "днів")} без змін`
    : "задача свіжа, швидко дасть результат");
  if (view.openSubtasks > 0) parts.push("є готовий план з підзадач");
  const why = parts.join(", ");
  return `${why.charAt(0).toUpperCase()}${why.slice(1)}.`;
};

/** Жарт за температурою задачі; без жартів, якщо рівень не «гарячий» (`null`). */
export const jokeFor = (view: ActiveTaskView): string | null => {
  const list = JOKES_A[view.heat];
  if (!list) return null;
  const joke = list[hashId(view.id) % list.length] ?? null;
  return joke === null ? null : joke.replace("{d}", `${view.staleDays} ${plural(view.staleDays, "день", "дні", "днів")}`);
};

export const deferredReason = (view: ActiveTaskView): string => (view.priority === "low" ? "низький пріоритет" : "може почекати день");
