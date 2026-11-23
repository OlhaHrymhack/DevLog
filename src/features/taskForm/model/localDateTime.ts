export const toLocalDateTime = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export const fromLocalDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isFinite(date.getTime()) && toLocalDateTime(date) === value) return date.toISOString();
};
