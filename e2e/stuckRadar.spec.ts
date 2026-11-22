import { expect, test, type Page } from "@playwright/test";

const panel = (page: Page) => page.getByRole("region", { name: "Радар застряглих" });
const scanButton = (page: Page) => panel(page).getByRole("button", { name: "Просканувати" });
const card = (page: Page, title: RegExp) => panel(page).getByRole("article", { name: title });

const T1 = /Виправити витік пам’яті/;
const T3 = /Флакі e2e-тест/;
const T12 = /Логування запитів до LLM/;

const scan = async (page: Page) => {
  await page.goto("/");
  await scanButton(page).click();
  await expect(panel(page).locator("li[data-state=done]")).toHaveCount(4);
};

test("DEV-012 AC-1 AC-2: скан показує t1, t3, t12 з діагнозами й діями, без t9 (TC-52…55)", async ({ page }) => {
  await scan(page);
  await expect(panel(page).getByRole("article")).toHaveCount(3);
  await expect(card(page, T1)).toContainText("Чекає на ревʼю.");
  await expect(card(page, T1).getByRole("button", { name: "Чернетка запиту на ревʼю" })).toBeVisible();
  await expect(card(page, T3)).toContainText("Задача розмита.");
  await expect(card(page, T3).getByRole("button", { name: "Розбити на підзадачі" })).toBeVisible();
  await expect(card(page, T12)).toContainText("Задача завелика.");
  await expect(card(page, T12).getByRole("button", { name: "Чернетка прохання про допомогу" })).toBeVisible();
  await expect(panel(page).getByRole("article", { name: /Rate limiting/ })).toHaveCount(0);
});

test("DEV-012 AC-4: «Зламати відповідь агента» → alert, лише «Відкрити задачу» без порад", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Стани прототипу" }).click();
  await page.getByLabel("Зламати відповідь агента").check();
  await page.keyboard.press("Escape");
  await scanButton(page).click();
  await expect(panel(page).getByRole("alert")).toContainText("Пропозиції агента відхилено.");
  await expect(panel(page).getByRole("button", { name: "Відкрити задачу" })).toHaveCount(3);
  await expect(panel(page).getByRole("button", { name: /Чернетка|Розбити/ })).toHaveCount(0);
});

test.describe("чернетки", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("DEV-012 AC-5: чернетка ревʼю з «PR #318» → «Скопіювати» → тост; «Відхилити» → тост, діалог закрито; без зовнішніх запитів (TC-57)", async ({ page }) => {
    await scan(page);
    const external: string[] = [];
    page.on("request", (request) => { if (!request.url().startsWith("http://localhost")) external.push(request.url()); });

    await card(page, T1).getByRole("button", { name: "Чернетка запиту на ревʼю" }).click();
    const dialog = page.getByRole("dialog", { name: "Чернетка запиту на ревʼю" });
    await expect(dialog.getByTestId("draft-text")).toContainText("PR #318");
    await expect(dialog.getByText("Агент нічого не надсилає сам. Скопіюйте й вставте в Slack.")).toBeVisible();
    await dialog.getByRole("button", { name: "Скопіювати" }).click();
    await expect(page.getByText("Чернетку скопійовано")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("PR #318");

    await dialog.getByRole("button", { name: "Відхилити" }).click();
    await expect(page.getByText("Чернетку відхилено")).toBeVisible();
    await expect(dialog).toHaveCount(0);
    expect(external).toEqual([]);
  });
});

test("DEV-012 AC-6: «Розбити на підзадачі» для t3 → /tasks/t3?tab=decompose&autorun=1, агент B запускається (TC-54)", async ({ page }) => {
  await scan(page);
  await card(page, T3).getByRole("button", { name: "Розбити на підзадачі" }).click();
  await expect(page).toHaveURL(/\/tasks\/t3\?.*autorun=1/);
  await expect(page.getByRole("region", { name: "Декомпозиція" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Декомпозиція" }).locator("li[data-state=done], li[data-state=run]").first()).toBeVisible();
});

test("DEV-012 AC-7: «Ігнорувати» ховає картку й не повертає її при повторному скані; після перезавантаження вона знову є (TC-56)", async ({ page }) => {
  await scan(page);
  await card(page, T12).getByRole("button", { name: "Ігнорувати" }).click();
  await expect(page.getByText(/Окей, вдаємо, що її не існує|Сховано до наступного сканування/)).toBeVisible();
  await expect(card(page, T12)).toHaveCount(0);
  await expect(panel(page).getByRole("article")).toHaveCount(2);

  await panel(page).getByRole("button", { name: "Сканувати ще раз" }).click();
  await expect(panel(page).locator("li[data-state=done]")).toHaveCount(4);
  await expect(card(page, T12)).toHaveCount(0);
  await expect(panel(page).getByRole("article")).toHaveCount(2);

  await scan(page);
  await expect(card(page, T12)).toBeVisible();
});

test("DEV-012 AC-8: усі застряглі відкладені → 🧘 «Нічого не застрягло…»", async ({ page }) => {
  await scan(page);
  for (const title of [T1, T3, T12]) await card(page, title).getByRole("button", { name: "Ігнорувати" }).click();
  await expect(panel(page).getByRole("article")).toHaveCount(0);
  await expect(panel(page).getByText("Нічого не застрягло. Або все під контролем, або ти забув оновити статуси.")).toBeVisible();
  await panel(page).getByRole("button", { name: "Сканувати ще раз" }).click();
  await expect(panel(page).getByText("Нічого не застрягло. Або все під контролем, або ти забув оновити статуси.")).toBeVisible();
});
