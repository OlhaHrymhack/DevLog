import { describe, expect, it } from "vitest";
import { clarityReasons, isVague } from "./isVague";

const CLEAR = { title: "Оновити Next.js до 15", description: "Ми на 13.5, частина залежностей уже не підтримує цю версію." };

describe("isVague", () => {
  it("DEV-010 AC-2: короткий опис або розмиті слова роблять задачу нечіткою", () => {
    expect(isVague({ title: "Зробити щось з тестами", description: "Тести погані." })).toBe(true);
    expect(clarityReasons({ title: "Зробити щось з тестами", description: "Тести погані." })).toHaveLength(2);
    expect(isVague({ title: "Оновити залежності", description: "Коротко." })).toBe(true);
    expect(isVague({ title: "Налаштувати все", description: "Потрібно якось налаштувати CI для всього монорепозиторію зараз." })).toBe(true);
  });

  it("DEV-010 AC-1: чітка задача з довгим описом без розмитих слів не потребує уточнення", () => {
    expect(isVague(CLEAR)).toBe(false);
    expect(clarityReasons(CLEAR)).toEqual([]);
  });
});
