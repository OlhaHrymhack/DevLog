import type { StuckCause } from "@/entities/agentRun";
import { plural } from "@/shared/lib/plural";

/** Жарт до картки (лише не в серйозному режимі): виводиться з причини, а не від моделі. */
export const stuckJoke = (cause: StuckCause, staleDays: number): string => {
  const days = `${staleDays} ${plural(staleDays, "день", "дні", "днів")}`;
  if (cause === "waiting-review") return "PR чекає ревʼю. Ревʼюер, мабуть, теж чекає, поки його хтось пінгане ⏳";
  if (cause === "vague") return `«В роботі» ${days} без жодної нотатки. Або ти геній, або вона тебе перемогла 🕸️`;
  if (cause === "too-big") return "Класична пастка «та там на 5 хвилин» 🫠";
  return "";
};

export const snoozeToast = (serious: boolean): string => (serious ? "Сховано до наступного сканування" : "🙈 Окей, вдаємо, що її не існує");
