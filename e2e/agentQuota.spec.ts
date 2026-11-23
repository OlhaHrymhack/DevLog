import { expect, test } from "@playwright/test";

test("DEV-019 AC-2: shows the shared AI limit and displays exhaustion on decomposition", async ({ page }) => {
  let shouldFail = true;
  let planUsed = 7;
  await page.route("**/api/health", (route) => route.fulfill({ json: { status: "ok", aiMode: "demo", agentQuota: true } }));
  await page.route("**/api/agents/quota", (route) => shouldFail
    ? route.fulfill({ status: 503, json: { error: { code: "TEST_ERROR", message: "Помилка" } } })
    : route.fulfill({ json: { enabled: true, limit: 150, used: { prioritize: planUsed, "stuck-radar": 50, "voice-draft": 0, decompose: 50, "status-update": 2 } } }));
  const exhaustedMessage = "Спільний ліміт AI вичерпано (150 запусків на всіх відвідувачів)";
  let decomposeRequests = 0;
  await page.route("**/api/agents/decompose", (route) => {
    decomposeRequests += 1;
    return route.fulfill({ status: 429, json: { error: { code: "AGENT_QUOTA_EXHAUSTED", message: exhaustedMessage } } });
  });

  await page.goto("/tasks/t7");
  const trigger = page.getByRole("button", { name: "Спроби AI" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Спроби AI" });
  await expect(dialog.getByRole("alert")).toContainText("Не вдалося оновити");
  shouldFail = false;
  await dialog.getByRole("button", { name: "Спробувати ще раз" }).click();
  const rows = dialog.getByRole("listitem");
  await expect(rows).toHaveCount(5);
  await expect(rows.filter({ hasText: "План на день" })).toContainText("Використано 7");
  await expect(rows.filter({ hasText: "Радар застряглих" })).toContainText("Використано 50");
  await expect(rows.filter({ hasText: "Голосовий ввід" })).toContainText("Використано 0");
  await expect(rows.filter({ hasText: "Декомпозиція задач" })).toContainText("Використано 50");
  await expect(rows.filter({ hasText: "Статус-апдейти" })).toContainText("Використано 2");
  await expect(dialog.getByText("41 із 150")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("button", { name: "Розбити з AI" })).toBeVisible();

  planUsed += 41;
  await trigger.click();
  await expect(dialog.getByText("0 із 150")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Розбити з AI" }).click();
  await expect(page.getByRole("region", { name: "Декомпозиція" }).getByRole("alert")).toContainText(exhaustedMessage);
  expect(decomposeRequests).toBe(1);
});
