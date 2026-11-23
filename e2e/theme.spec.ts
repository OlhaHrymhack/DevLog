import { expect, test } from "@playwright/test";

const STORAGE_KEY = "devlog-theme";

test("DEV-002 AC-4: перший візит — тема dark за замовчуванням", async ({ page }) => {
  await page.goto("/ui-kit");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Увімкнути світлу тему" })).toBeVisible();
});

test("DEV-002 AC-4: клік перемикає на light і зберігає вибір", async ({ page }) => {
  await page.goto("/ui-kit");
  await page.getByRole("button", { name: "Увімкнути світлу тему" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe("light");
  await expect(page.getByRole("button", { name: "Увімкнути темну тему" })).toBeVisible();
});

test("DEV-002 AC-4: після reload light одразу в першому кадрі, до гідратації", async ({ page }) => {
  await page.goto("/ui-kit");
  await page.getByRole("button", { name: "Увімкнути світлу тему" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  // Без клієнтських чанків React не гідратується: сервер віддає dark, тож light міг поставити лише інлайн-скрипт.
  await page.route("**/_next/static/**", (route) => route.abort());
  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
