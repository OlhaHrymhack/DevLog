import { expect, test } from "@playwright/test";

test("DEV-018 AC-1 AC-3 AC-4: reads current quota, handles retries, and hides other agents in the public demo", async ({ page }) => {
  let shouldFail = true;
  let planUsed = 7;
  await page.route("**/api/health", (route) => route.fulfill({ json: { status: "ok", aiMode: "demo", agentQuota: true } }));
  await page.route("**/api/agents/quota", (route) => shouldFail
    ? route.fulfill({ status: 503, json: { error: { code: "TEST_ERROR", message: "Помилка" } } })
    : route.fulfill({ json: { enabled: true, limit: 50, used: { prioritize: planUsed, "stuck-radar": 50, "voice-draft": 0 } } }));

  await page.goto("/tasks/t7");
  const trigger = page.getByRole("button", { name: "Спроби AI" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Спроби AI" });
  await expect(dialog.getByRole("alert")).toContainText("Не вдалося оновити");
  shouldFail = false;
  await dialog.getByRole("button", { name: "Спробувати ще раз" }).click();
  const rows = dialog.getByRole("listitem");
  await expect(rows).toHaveCount(3);
  await expect(rows.filter({ hasText: "План на день" })).toContainText("Використано 7 · залишилось 43");
  await expect(rows.filter({ hasText: "Радар застряглих" })).toContainText("Використано 50 · залишилось 0");
  await expect(rows.filter({ hasText: "Голосовий ввід" })).toContainText("Використано 0 · залишилось 50");
  await expect(dialog.getByText("93 із 150")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("button", { name: "Розбити з AI" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Апдейт" })).toHaveCount(0);

  planUsed += 1;
  await trigger.click();
  await expect(dialog.getByText("92 із 150")).toBeVisible();
});
