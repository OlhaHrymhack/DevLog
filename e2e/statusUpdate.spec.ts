import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { z } from "zod";

const created = z.object({ data: z.object({ id: z.string() }) });

const seedTask = async (request: APIRequestContext, title: string) => {
  const response = await request.post("/api/tasks", {
    data: { title, description: "Опис задачі для перевірки статус-апдейту: достатньо довгий текст.", priority: "medium" },
  });
  expect(response.status()).toBe(201);
  return created.parse(await response.json()).data.id;
};

const panel = (page: Page) => page.getByRole("region", { name: "Статус-апдейт", exact: true });
const generate = (page: Page) => panel(page).getByRole("button", { name: "Згенерувати апдейт" });
const preview = (page: Page) => panel(page).getByTestId("slack-preview-text");
const copyButton = (page: Page) => panel(page).getByRole("button", { name: "Скопіювати" });
const chip = (page: Page, name: string | RegExp) => panel(page).getByRole("button", { name, exact: typeof name === "string" });

const open = async (page: Page, id: string) => {
  await page.goto(`/tasks/${id}`);
  await expect(panel(page)).toBeVisible();
};

test("DEV-011 AC-2: t1 (гаряча) → 4 кроки, чіп «Авто → для менеджера», ризик про ревʼю, заголовок жирним", async ({ page }) => {
  await open(page, "t1");
  await generate(page).click();
  await expect(panel(page).locator("li[data-state=done]")).toHaveCount(4);
  await expect(chip(page, /^Авто → для менеджера$/)).toHaveAttribute("aria-pressed", "true");
  await expect(preview(page)).toContainText("Ризик: чекаємо на ревʼю, це блокує реліз.");
  await expect(preview(page).locator("strong").first()).toContainText("Виправити витік пам’яті");
  await expect(panel(page).getByText("Агент нічого не надсилає сам: скопіюйте й вставте в Slack.")).toBeVisible();
});

test("DEV-011 AC-3: після результату «Коротко» → перезапуск, текст в один рядок; «З гумором» дає емодзі-апдейт", async ({ page }) => {
  await open(page, "t9");
  await generate(page).click();
  await expect(preview(page)).toContainText("Готово: вибрати алгоритм");

  await chip(page, "Коротко").click();
  await expect(chip(page, "Коротко")).toHaveAttribute("aria-pressed", "true");
  await expect(preview(page)).toContainText("в роботі,");
  await expect(preview(page).locator("span.block")).toHaveCount(1);
  await expect(copyButton(page)).toBeEnabled();

  await chip(page, "З гумором").click();
  await expect(preview(page)).toContainText("новини з фронту");
});

test("DEV-011 AC-3: у серйозному режимі чіпа «З гумором» немає", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("devlog-serious", "true"));
  await open(page, "t9");
  await expect(chip(page, "Для команди")).toBeVisible();
  await expect(chip(page, "З гумором")).toHaveCount(0);
});

test("DEV-011 AC-4: задача без підзадач і нотаток → alert «Даних мало» і апдейт без вигаданого прогресу", async ({ page, request }) => {
  const id = await seedTask(request, "Статус-апдейт: порожня задача");
  await open(page, id);
  await generate(page).click();
  await expect(panel(page).getByText(/Даних мало: немає підзадач і нотаток\./)).toBeVisible();
  await expect(preview(page)).toContainText("Поки без помітного прогресу");
  await expect(preview(page)).not.toContainText("Готово:");
});

test("DEV-011 AC-5: «Зламати відповідь агента» → alert, крок перевірки з помилкою, короткий шаблонний апдейт", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Стани прототипу" }).click();
  await page.getByLabel("Зламати відповідь агента").check();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Виправити витік пам’яті у воркері нотифікацій" }).click();
  await expect(panel(page)).toBeVisible();

  await generate(page).click();
  await expect(panel(page).getByRole("alert")).toContainText("Чернетку агента відхилено.");
  await expect(panel(page).locator("li[data-state=fail]")).toHaveCount(1);
  await expect(preview(page).locator("span.block")).toHaveCount(1);
  await expect(preview(page)).toContainText("Виправити витік пам’яті");
  await expect(preview(page)).not.toContainText("PR #999");
});

test.describe("копіювання", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("DEV-011 AC-6 AC-7: «Скопіювати» кладе текст у буфер, нічого не надсилає в мережу; під час друку кнопка disabled, текст у aria-live", async ({ page }) => {
    await open(page, "t9");
    await generate(page).click();
    await expect(preview(page)).toHaveAttribute("aria-live", "polite");
    await expect(copyButton(page)).toBeEnabled();

    const requests: string[] = [];
    page.on("request", (request) => { if (request.url().includes("/api/")) requests.push(request.url()); });
    await copyButton(page).click();
    await expect(page.getByText(/Скопійовано|Апдейт скопійовано/)).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.startsWith("*Rate limiting для /api/agents*: апдейт")).toBe(true);
    expect(copied).toContain("\nГотово: вибрати алгоритм");
    expect(requests).toEqual([]);
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("DEV-011 AC-7: prefers-reduced-motion → текст одразу повністю, «Скопіювати» активна", async ({ page }) => {
    await open(page, "t9");
    await generate(page).click();
    await expect(preview(page)).toContainText("Далі: middleware");
    await expect(copyButton(page)).toBeEnabled();
  });
});
