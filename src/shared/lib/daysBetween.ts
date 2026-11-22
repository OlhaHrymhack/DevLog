import { MS_PER_DAY, toMillis, type Timestamp } from "./timestamp";

/** Повні доби між `ts` і `now`: floor((now − ts) / 1 доба). `now` передається ззовні — тести детерміновані. */
export const daysBetween = (ts: Timestamp, now: Timestamp): number => {
  return Math.floor((toMillis(now) - toMillis(ts)) / MS_PER_DAY);
};
