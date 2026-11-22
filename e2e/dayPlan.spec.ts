import { expect, test, type Page } from "@playwright/test";

const rows = "[data-slot='task-row']";
const panel = (page: Page) => page.getByRole("region", { name: "План на день" });
const plan = (page: Page) => page.getByRole("list", { name: "План на день" });
const runButton = (page: Page) => panel(page).getByRole("button", { name: /Скласти план на день/ });

const AGENT_API = "**/api/agents/prioritize";

const buildPlan = async (page: Page) => {
  await runButton(page).click();
  await expect(plan(page)).toBeVisible();
  await expect(plan(page).getByRole("listitem")).toHaveCount(3);
};

const focusBadges = (page: Page) => page.locator(rows).getByText(/^Фокус #\d$/);

test("DEV-009 AC-5: план із 4 кроків і поясненнями; «Скасувати» в діалозі нічого не змінює; «Закріпити» → «Фокус #1…#3» без зміни статусів", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(rows)).not.toHaveCount(0);
  const statusesBefore = await page.locator(rows).allInnerTexts();
  const badgesBefore = await focusBadges(page).count();

  await runButton(page).click();
  await expect(panel(page).locator("li[data-state=done]")).toHaveCount(4);
  await expect(plan(page).getByRole("listitem")).toHaveCount(3);
  await expect(plan(page).getByRole("listitem").first()).toContainText("Міграція auth");
  await expect(panel(page).getByText(/дедлайн менш ніж за добу/i)).toBeVisible();
  await expect(panel(page).getByText("Це пропозиція: фокус дня зміниться лише після підтвердження.")).toBeVisible();
  await expect(panel(page).getByTestId("agent-run-summary")).toContainText("мок-відповідь");

  await panel(page).getByRole("button", { name: "Застосувати порядок" }).click();
  const dialog = page.getByRole("dialog", { name: "Закріпити фокус дня?" });
  await expect(dialog).toContainText("Статуси й пріоритети не зміняться.");
  await dialog.getByRole("button", { name: "Скасувати" }).click();
  await expect(dialog).toBeHidden();
  await expect(focusBadges(page)).toHaveCount(badgesBefore);

  await panel(page).getByRole("button", { name: "Застосувати порядок" }).click();
  await dialog.getByRole("button", { name: "Закріпити" }).click();
  await expect(focusBadges(page)).toHaveCount(3);
  await expect(page.locator(rows).filter({ hasText: "Фокус #1" })).toContainText("Міграція auth");
  await expect(runButton(page)).toBeVisible();
  await expect(panel(page).getByText(/Фокус дня закріплено:/)).toBeVisible();
  expect(await page.locator(rows).allInnerTexts().then((texts) => texts.map((text) => text.replace(/Фокус #\d/, "")))).toEqual(
    statusesBefore.map((text) => text.replace(/Фокус #\d/, "")),
  );
});

test("DEV-009 AC-4: «Зламати відповідь агента» → червоний alert, крок перевірки з помилкою, «Взяти цей порядок» → бейджі «Фокус #1–3»", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Стани прототипу" }).click();
  await page.getByLabel("Зламати відповідь агента").check();
  await page.keyboard.press("Escape");

  await runButton(page).click();
  const alert = panel(page).getByRole("alert");
  await expect(alert).toContainText("Відповідь агента відхилено.");
  await expect(panel(page).locator("li[data-state=fail]")).toHaveCount(1);
  await expect(panel(page).getByText(/Без пояснень від AI/)).toBeVisible();

  await panel(page).getByRole("button", { name: "Взяти цей порядок" }).click();
  const dialog = page.getByRole("dialog", { name: "Закріпити порядок за правилом?" });
  await dialog.getByRole("button", { name: "Закріпити" }).click();
  await expect(focusBadges(page)).toHaveCount(3);
  await expect(page.locator(rows).filter({ hasText: "Фокус #1" })).toContainText("Міграція auth");
});

test("DEV-009 AC-6: лише done-задачі → «Немає активних задач для аналізу», кнопки запуску немає", async ({ page }) => {
  const done = {
    id: "done-1", title: "Давно закрита задача", description: "Опис закритої задачі", status: "done", priority: "low",
    createdAt: "2026-11-01T10:00:00.000Z", updatedAt: "2026-11-02T10:00:00.000Z", dueAt: null, focusRank: null,
    subtaskCount: 0, subtaskDone: 0,
  };
  await page.route(/\/api\/tasks(?:\?|$)/, (route) => {
    if (route.request().url().includes("page=")) return route.continue();
    return route.fulfill({ json: { data: [done] } });
  });
  await page.goto("/");
  await expect(panel(page).getByText(/Немає активних задач для аналізу\./)).toBeVisible();
  await expect(panel(page).getByText(/Підозріло спокійно/)).toBeVisible();
  await expect(runButton(page)).toHaveCount(0);
});

test("DEV-009 AC-7: «Зупинити» повертає панель в очікування", async ({ page }) => {
  await page.route(AGENT_API, () => new Promise(() => undefined));
  await page.goto("/");
  await runButton(page).click();
  await expect(panel(page).getByRole("button", { name: "Зупинити" })).toBeVisible();
  await panel(page).getByRole("button", { name: "Зупинити" }).click();
  await expect(runButton(page)).toBeVisible();
  await expect(plan(page)).toHaveCount(0);
});

test("DEV-009 AC-7: «Перегенерувати план» запускає новий запуск, «Відхилити» → тост і очікування", async ({ page }) => {
  let runs = 0;
  page.on("request", (request) => { if (request.url().includes("/api/agents/prioritize")) runs += 1; });
  await page.goto("/");
  await buildPlan(page);
  expect(runs).toBe(1);

  await panel(page).getByRole("button", { name: "Перегенерувати план" }).click();
  await expect(plan(page)).toBeVisible();
  await expect.poll(() => runs).toBe(2);

  await panel(page).getByRole("button", { name: "Відхилити" }).click();
  await expect(page.getByText("Відхилено", { exact: true })).toBeVisible();
  await expect(runButton(page)).toBeVisible();
  await expect(plan(page)).toHaveCount(0);
});

test.describe("мобільний екран", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("DEV-009 AC-9: 375px — панель згорнута з підсумком, тап розгортає (aria-expanded)", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /План на день/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText("Пропонує, з чого почати день, і пояснює чому")).toBeVisible();
    await expect(runButton(page)).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(runButton(page)).toBeVisible();
  });
});
