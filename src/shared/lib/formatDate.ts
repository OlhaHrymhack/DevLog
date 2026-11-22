import { toMillis, type Timestamp } from "./timestamp";

const MONTHS = [
  "січня",
  "лютого",
  "березня",
  "квітня",
  "травня",
  "червня",
  "липня",
  "серпня",
  "вересня",
  "жовтня",
  "листопада",
  "грудня",
];

/** «21 листопада 2026, 14:05» — у локальній часовій зоні. */
export const formatDate = (ts: Timestamp): string => {
  const date = new Date(toMillis(ts));
  const month = MONTHS[date.getMonth()] ?? "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${date.getDate()} ${month} ${date.getFullYear()}, ${hours}:${minutes}`;
};
