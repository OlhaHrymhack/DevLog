import { expect, test } from "@playwright/test";

test("DEV-001 AC-1: головна сторінка віддає 200 і показує DevLog", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "DevLog" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "uk");
});
