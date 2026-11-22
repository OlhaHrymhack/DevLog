export type HeatKey = "fresh" | "calm" | "done" | "warm" | "hot" | "fire" | "alarm";

export type HeatLevel = {
  key: HeatKey;
  emoji: string;
  name: string;
  rule: string;
  meaning: string;
  joke: string;
  /** Чи показується рівень у списку (лише 🌶️ і вище). */
  show: boolean;
  rank: number;
};

export const HEAT_LEVELS: Record<HeatKey, HeatLevel> = {
  fresh: { key: "fresh", emoji: "🥒", name: "Свіжа", rule: "Будь-який пріоритет, оновлювалась за останні 2 дні", meaning: "Усе гаразд, задача рухається. Нічого робити не треба", joke: "Свіженька, хрумка, ще ніхто не встиг її зіпсувати", show: false, rank: 0 },
  calm: { key: "calm", emoji: "🧊", name: "Спокійна", rule: "Низький пріоритет, будь-який вік", meaning: "Не термінова, може почекати. Для вільної години", joke: "Лежить у морозилці. Нікому не заважає, нікого не чекає", show: false, rank: 0 },
  done: { key: "done", emoji: "✅", name: "Готово", rule: "Статус «Готово»", meaning: "Задачу закрито, жодних дій", joke: "Здано. Можна забути з чистою совістю", show: false, rank: -1 },
  warm: { key: "warm", emoji: "🌶️", name: "Тепленька", rule: "Середній або високий пріоритет, 3–4 дні без змін", meaning: "Починає застрягати. Перевірте, чи нічого не блокує", joke: "Ще не горить. Просто тліє, як твоя мотивація в понеділок", show: true, rank: 1 },
  hot: { key: "hot", emoji: "🌶️🌶️", name: "Гаряча", rule: "Високий пріоритет, 5–6 днів без змін", meaning: "Помітно затримується й впливає на інших. Взяти найближчим часом", joke: "Задачу помітив навіть менеджер. Це погано", show: true, rank: 2 },
  fire: { key: "fire", emoji: "🌶️🌶️🌶️🔥", name: "Палає", rule: "Високий пріоритет, 7+ днів без змін", meaning: "Прострочена за відчуттями команди. Зробити сьогодні або розбити", joke: "Ця задача вже має стаж. Скоро попросить підвищення", show: true, rank: 3 },
  alarm: { key: "alarm", emoji: "🏚️🔥🚒", name: "Пожежна тривога", rule: "До дедлайну менше 24 годин, статус не «Готово»", meaning: "Критично: кинути все інше або чесно перенести дедлайн", joke: "Час удавати, що так і було задумано", show: true, rank: 4 },
};

/** Порядок у легенді (прототип HEAT_ORDER). */
export const HEAT_ORDER: readonly HeatKey[] = ["fresh", "calm", "done", "warm", "hot", "fire", "alarm"];
