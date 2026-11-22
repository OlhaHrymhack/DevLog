/** Українська множина: 1 день · 2 дні · 5 днів (11–19 — завжди «many»). */
export function plural(n: number, one: string, few: string, many: string): string {
  const lastTwo = Math.abs(n) % 100;
  const last = lastTwo % 10;
  if (lastTwo > 10 && lastTwo < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}
