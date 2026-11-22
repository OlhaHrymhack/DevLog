import { describe, expect, it } from "vitest";
import { ageLabel } from "./ageLabel";
import { daysBetween } from "./daysBetween";
import { formatDate } from "./formatDate";
import { plural } from "./plural";

const NOW = new Date(2026, 10, 21, 14, 5).getTime();
const DAY = 86_400_000;

describe("plural", () => {
  function forms(n: number) {
    return plural(n, "день", "дні", "днів");
  }

  it("DEV-002 AC-3: plural — 1 день, 2 дні, 5 днів, 11 днів, 21 день", () => {
    expect(forms(1)).toBe("день");
    expect(forms(2)).toBe("дні");
    expect(forms(5)).toBe("днів");
    expect(forms(11)).toBe("днів");
    expect(forms(21)).toBe("день");
  });

  it("DEV-002 AC-3: plural — винятки 12–14 і 111–114 лишаються «many»", () => {
    expect(forms(12)).toBe("днів");
    expect(forms(14)).toBe("днів");
    expect(forms(112)).toBe("днів");
    expect(forms(22)).toBe("дні");
  });
});

describe("daysBetween і ageLabel", () => {
  it("DEV-002 AC-3: daysBetween рахує повні доби, now передається параметром", () => {
    expect(daysBetween(NOW - 2.9 * DAY, NOW)).toBe(2);
    expect(daysBetween(new Date(NOW - 3 * DAY).toISOString(), NOW)).toBe(3);
  });

  it("DEV-002 AC-3: ageLabel — 0 → «сьогодні», далі число з правильною формою", () => {
    expect(ageLabel(NOW - 0.4 * DAY, NOW)).toBe("сьогодні");
    expect(ageLabel(NOW - 1 * DAY, NOW)).toBe("1 день");
    expect(ageLabel(NOW - 2 * DAY, NOW)).toBe("2 дні");
    expect(ageLabel(NOW - 5 * DAY, NOW)).toBe("5 днів");
    expect(ageLabel(NOW - 11 * DAY, NOW)).toBe("11 днів");
    expect(ageLabel(NOW - 21 * DAY, NOW)).toBe("21 день");
  });
});

describe("formatDate", () => {
  it("DEV-002 AC-3: formatDate — «21 листопада 2026, 14:05»", () => {
    expect(formatDate(new Date(2026, 10, 21, 14, 5))).toBe("21 листопада 2026, 14:05");
  });

  it("DEV-002 AC-3: formatDate доповнює години й хвилини нулями", () => {
    expect(formatDate(new Date(2026, 0, 3, 9, 7))).toBe("3 січня 2026, 09:07");
  });
});
