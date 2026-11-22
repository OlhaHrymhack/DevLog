import { daysBetween } from "./daysBetween";
import { plural } from "./plural";
import type { Timestamp } from "./timestamp";

export const ageLabel = (ts: Timestamp, now: Timestamp): string => {
  const days = daysBetween(ts, now);
  if (days <= 0) return "сьогодні";
  return `${days} ${plural(days, "день", "дні", "днів")}`;
};
