import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "../../model/theme";
import { ThemeToggle } from ".";

beforeEach(() => {
  document.documentElement.setAttribute("data-theme", "dark");
  localStorage.clear();
});

afterEach(cleanup);

describe("ThemeToggle", () => {
  it("DEV-002 AC-4: темна тема за замовчуванням — кнопка пропонує світлу", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Увімкнути світлу тему" })).toBeTruthy();
  });

  it("DEV-002 AC-4: клік перемикає data-theme, зберігає вибір у localStorage і міняє підпис", async () => {
    render(<ThemeToggle />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Увімкнути світлу тему" }));
    });
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(screen.getByRole("button", { name: "Увімкнути темну тему" })).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Увімкнути темну тему" }));
    });
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("DEV-002 AC-4: інлайн-скрипт відновлює збережену світлу тему до гідратації", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("DEV-002 AC-4: інлайн-скрипт ігнорує невалідне значення (лишається dark)", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "purple");
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
