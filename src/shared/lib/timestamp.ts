export type Timestamp = string | number | Date;

export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;

export const toMillis = (value: Timestamp): number => {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
};
