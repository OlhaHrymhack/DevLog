import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { z } from "zod";

const created = z.object({ data: z.object({ id: z.string() }) });

const CLEAR = {
  title: "Оновити Next.js до 16",
  description: "Ми на 15.2, частина залежностей уже не підтримує цю версію. Потрібен upgrade з переходом на нові кешування fetch.",
};
const VAGUE = { title: "Зробити щось з тестами", description: "Тести погані." };

const seedTask = async (request: APIRequestContext, task: { title: string; description: string }) => {
  const response = await request.post("/api/tasks", { data: { ...task, priority: "medium" } });
  expect(response.status()).toBe(201);
  return created.parse(await response.json()).data.id;
};

const panel = (page: Page) => page.getByRole("region", { name: "Декомпозиція" });
const runButton = (page: Page) => panel(page).getByRole("button", { name: "Розбити на підзадачі" });
const suggestions = (page: Page) => panel(page).getByRole("checkbox");
const createButton = (page: Page) => panel(page).getByRole("button", { name: /^Створити \d/ });
const subtaskItems = (page: Page) => page.getByRole("region", { name: "Підзадачі" }).getByRole("listitem");

const open = async (page: Page, id: string, query = "") => {
  await page.goto(`/tasks/${id}${query}`);
  await expect(panel(page)).toBeVisible();
};

test("DEV-010 AC-1 AC-4 AC-9: чітка задача → 5 пунктів, нічого не створено до «Створити», створено лише обрані з бейджем AI, applied і «Розбити ще раз»", async ({ page, request }) => {
  const id = await seedTask(request, CLEAR);
  await open(page, id);

  await runButton(page).click();
  await expect(panel(page).locator("li[data-state=done]")).toHaveCount(4);
  await expect(suggestions(page)).toHaveCount(5);
  await expect(page.getByText("Підзадач ще немає")).toBeVisible();
  await expect(panel(page).getByText("Нічого не створено, доки ви не натиснете «Створити».")).toBeVisible();

  await suggestions(page).first().uncheck();
  await expect(createButton(page)).toHaveText("Створити 4 підзадачі");
  await createButton(page).click();

  await expect(panel(page).getByText(/Створено 4 підзадачі\./)).toBeVisible();
  await expect(subtaskItems(page)).toHaveCount(4);
  await expect(page.getByRole("region", { name: "Підзадачі" }).getByText("✦ AI")).toHaveCount(4);

  await panel(page).getByRole("button", { name: "Розбити ще раз" }).click();
  await expect(panel(page).getByText("Пропоновані підзадачі")).toBeVisible();
  const created = await subtaskItems(page).allInnerTexts();
  const offered = await panel(page).getByRole("checkbox").evaluateAll((boxes) => boxes.map((box) => box.getAttribute("id")));
  expect(offered.length).toBeGreaterThanOrEqual(3);
  for (const title of created.map((text) => text.split("\n")[0] ?? "")) {
    await expect(panel(page).locator("label", { hasText: title })).toHaveCount(0);
  }
});

test("DEV-010 AC-4: усі чекбокси зняті → «Створити» disabled; «Скасувати» повертає idle без створення (TC-44)", async ({ page, request }) => {
  const id = await seedTask(request, { ...CLEAR, title: "Оновити Next.js до 17" });
  await open(page, id);
  await runButton(page).click();
  await expect(suggestions(page)).toHaveCount(5);
  for (const box of await suggestions(page).all()) await box.uncheck();
  await expect(panel(page).getByRole("button", { name: /^Створити 0/ })).toBeDisabled();

  await panel(page).getByRole("button", { name: "Скасувати" }).click();
  await expect(runButton(page)).toBeVisible();
  await expect(page.getByText("Підзадач ще немає")).toBeVisible();
});

test("DEV-010 AC-2 AC-3: нечітка задача → підказка, питання, уточнення зберігається нотаткою й дає шаблон tests (TC-38, TC-39)", async ({ page, request }) => {
  const id = await seedTask(request, VAGUE);
  await open(page, id);
  await expect(panel(page).getByText("Опис короткий: агент, найімовірніше, попросить уточнення.")).toBeVisible();

  await runButton(page).click();
  await expect(panel(page).getByText(/Опису замало, щоб розбити задачу/)).toBeVisible();
  await expect(panel(page).getByText("Підзадачі не генеруються, доки немає відповіді.")).toBeVisible();
  await expect(suggestions(page)).toHaveCount(0);

  const field = panel(page).getByRole("textbox", { name: "Ваша відповідь" });
  await field.fill("ні");
  await panel(page).getByRole("button", { name: "Відповісти і продовжити" }).click();
  await expect(panel(page).getByText("Напишіть хоча б кілька слів")).toBeVisible();

  await field.fill("e2e checkout, падає 1 з 8 у CI");
  await panel(page).getByRole("button", { name: "Відповісти і продовжити" }).click();
  await expect(suggestions(page)).toHaveCount(4);
  await expect(page.getByText("Уточнення для декомпозиції: e2e checkout, падає 1 з 8 у CI")).toBeVisible();
});

test("DEV-010 AC-7: «Скасувати» у clarify → idle; «Зупинити» → idle", async ({ page, request }) => {
  const id = await seedTask(request, { ...VAGUE, title: "Зробити щось із CI" });
  await open(page, id);
  await runButton(page).click();
  await expect(panel(page).getByRole("textbox", { name: "Ваша відповідь" })).toBeVisible();
  await panel(page).getByRole("button", { name: "Скасувати" }).click();
  await expect(runButton(page)).toBeVisible();

  await page.route("**/api/agents/decompose", () => new Promise(() => undefined));
  await runButton(page).click();
  await panel(page).getByRole("button", { name: "Зупинити" }).click();
  await expect(runButton(page)).toBeVisible();
});

test("DEV-010 AC-8: ?tab=decompose&autorun=1 запускає агента одразу і прибирає параметр; «Розбити з AI» теж", async ({ page, request }) => {
  const first = await seedTask(request, { ...CLEAR, title: "Оновити Next.js до 18" });
  await page.goto(`/tasks/${first}?tab=decompose&autorun=1`);
  await expect(panel(page).getByText("Пропоновані підзадачі")).toBeVisible();
  await expect(page).not.toHaveURL(/autorun/);

  const second = await seedTask(request, { ...CLEAR, title: "Оновити Next.js до 19" });
  await open(page, second);
  await page.getByRole("button", { name: "Розбити з AI" }).click();
  await expect(panel(page).getByText("Пропоновані підзадачі")).toBeVisible();
});

test("DEV-010 AC-6: «Зламати відповідь агента» → alert, 4 пункти шаблону generic, крок перевірки з помилкою, «Створити 4 підзадачі» працює", async ({ page, request }) => {
  const title = `Оновити Next.js до 20 · ${Date.now()}`;
  await seedTask(request, { ...CLEAR, title });
  await page.goto("/");
  await page.getByRole("button", { name: "Стани прототипу" }).click();
  await page.getByLabel("Зламати відповідь агента").check();
  await page.keyboard.press("Escape");
  await page.getByRole("searchbox", { name: "Пошук задач" }).fill(title);
  await page.getByRole("link", { name: title }).click();
  await expect(panel(page)).toBeVisible();

  await runButton(page).click();
  await expect(panel(page).getByRole("alert")).toContainText("Відповідь агента відхилено.");
  await expect(panel(page).locator("li[data-state=fail]")).toHaveCount(1);
  await expect(suggestions(page)).toHaveCount(4);
  await createButton(page).click();
  await expect(subtaskItems(page)).toHaveCount(4);
});

test.describe("мобільний екран", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("DEV-010 AC-8: 375px — ?tab=decompose&autorun=1 відкриває вкладку «Підзадачі» з уже запущеним агентом", async ({ page, request }) => {
    const id = await seedTask(request, { ...CLEAR, title: "Оновити Next.js до 21" });
    await page.goto(`/tasks/${id}?tab=decompose&autorun=1`);
    await expect(page.getByRole("tab", { name: /Підзадачі/ })).toHaveAttribute("aria-selected", "true");
    await expect(panel(page).getByText("Пропоновані підзадачі")).toBeVisible();
  });
});
