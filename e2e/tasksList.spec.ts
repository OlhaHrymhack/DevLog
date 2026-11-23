import { expect, test } from "@playwright/test";

const tasksApi = /\/api\/tasks(?:\?|$)/;
const rows = "[data-slot='task-row']";

test("DEV-005 AC-1 AC-2 AC-3 AC-4: API list, status counts, sorting, search and reset", async ({ page }) => {
  await page.goto("/");
  const tasks = page.locator(rows);
  await expect(tasks).toHaveCount(10);
  await expect(page.getByTestId("task-summary")).toContainText("12 задач · 4 в роботі · 3 гарячі");
  await expect(tasks.nth(0)).toContainText("Rate limiting");
  await expect(tasks.nth(1)).toContainText("Виправити витік");
  await expect(tasks.nth(2)).toContainText("Оновити Next.js до 15");
  await expect(tasks.nth(3)).toContainText("Міграція auth");

  const filter = page.getByRole("group", { name: "Фільтр за статусом" });
  const inProgress = filter.getByRole("button", { name: "В роботі 4" });
  await inProgress.click();
  await expect(inProgress).toHaveAttribute("aria-pressed", "true");
  await expect(tasks).toHaveCount(4);
  for (const label of ["Всі 12", "До роботи 6", "В роботі 4", "Готово 2"]) {
    await expect(filter.getByRole("button", { name: label })).toBeVisible();
  }

  const search = page.getByRole("searchbox", { name: "Пошук задач" });
  await search.fill("логування");
  await expect(tasks).toHaveCount(1);
  await expect(tasks.first()).toContainText("Логування запитів до LLM");
  await search.fill("без збігів");
  await expect(page.getByText("Нічого не знайдено за запитом «без збігів»")).toBeVisible();
  await page.getByRole("button", { name: "Скинути фільтри" }).click();
  await expect(tasks).toHaveCount(10);
  const sort = page.getByRole("combobox", { name: "Сортування" });
  await sort.selectOption("date-asc");
  await expect(tasks.first()).toContainText("Дашборд метрик агентів");
  await sort.selectOption("priority-asc");
  await expect(tasks.first()).toContainText("Оновити README");
});

test("DEV-005 AC-5: loading, error, retry and empty", async ({ page }) => {
  let returnError = true;
  const failure = Promise.withResolvers<void>();
  await page.route(tasksApi, async (route) => {
    if (!returnError) return route.continue();
    await failure.promise;
    await route.fulfill({ status: 500, json: { error: { code: "INTERNAL_ERROR", message: "Помилка" } } });
  });
  await page.goto("/");
  try {
    await expect(page.getByTestId("task-list-loading")).toHaveAttribute("aria-busy", "true");
  } finally {
    failure.resolve();
  }
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Не вдалося завантажити задачі");
  returnError = false;
  await page.getByRole("button", { name: "Спробувати ще раз" }).click();
  await expect(page.locator(rows)).toHaveCount(10);

  await page.unroute(tasksApi);
  await page.route(tasksApi, (route) => route.fulfill({
    json: {
      data: [],
      pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
      summary: { all: 0, todo: 0, "in-progress": 0, done: 0, hot: 0 },
    },
  }));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Нічого не горить" })).toBeVisible();
  await expect(page.locator(rows)).toHaveCount(0);
});

test("DEV-005 AC-13: navigation fetches the next server page and filters reset it", async ({ page }) => {
  await page.goto("/");
  const tasks = page.locator(rows);
  const pager = page.getByRole("navigation", { name: "Сторінки задач" });
  const next = pager.getByRole("button", { name: "Далі" });
  const previous = pager.getByRole("button", { name: "Назад" });
  await expect(tasks).toHaveCount(10);
  await expect(pager.getByText("Сторінка 1 з 2")).toBeVisible();
  await expect(previous).toBeDisabled();

  const secondPage = page.waitForResponse((response) => {
    const { pathname, searchParams } = new URL(response.url());
    return pathname === "/api/tasks" && searchParams.get("page") === "2" && response.ok();
  });
  await next.click();
  await expect((await (await secondPage).json()).data).toHaveLength(2);
  await expect(pager.getByText("Сторінка 2 з 2")).toBeVisible();
  await expect(tasks).toHaveCount(2);
  await expect(tasks.first()).toContainText("Виправити одруківку");
  await expect(next).toBeDisabled();
  await expect(page.getByTestId("task-summary")).toContainText("12 задач");

  await previous.click();
  await expect(pager.getByText("Сторінка 1 з 2")).toBeVisible();
  await expect(tasks).toHaveCount(10);
  await next.click();
  await expect(pager.getByText("Сторінка 2 з 2")).toBeVisible();

  const filteredPage = page.waitForResponse((response) => {
    const { pathname, searchParams } = new URL(response.url());
    return pathname === "/api/tasks" && searchParams.get("page") === "1"
      && searchParams.get("status") === "in-progress" && response.ok();
  });
  await page.getByRole("button", { name: "В роботі 4" }).click();
  await filteredPage;
  await expect(tasks).toHaveCount(4);
  await expect(pager).toHaveCount(0);
  await expect(page.getByTestId("task-summary")).toContainText("12 задач");
});

test("DEV-005 AC-6 AC-8 AC-9 AC-12: heat legend, demo mode, skip link and keyboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Демо-режим AI.")).toBeVisible();
  await expect(page.getByText(/Без OPENAI_API_KEY/)).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Перейти до вмісту" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();

  const search = page.getByRole("searchbox", { name: "Пошук задач" });
  await page.keyboard.press("/");
  await expect(search).toBeFocused();
  await page.keyboard.press("N");
  await expect(search).toHaveValue("N");
  await search.clear();

  const alarm = page.locator(rows).filter({ hasText: "Міграція auth" });
  const heat = alarm.getByRole("button", { name: /Температура: Пожежна тривога/ });
  await expect(heat).toContainText("🏚️🔥🚒");
  await heat.focus();
  await expect(page.getByRole("tooltip")).toContainText("Пожежна тривога");

  const legend = page.getByRole("button", { name: "Температура задач: легенда" });
  await legend.click();
  const dialog = page.getByRole("dialog", { name: "Температура задач" });
  await expect(dialog.getByRole("row")).toHaveCount(8);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(legend).toBeFocused();

  await page.route("**/api/health", (route) => route.fulfill({ json: { status: "ok", aiMode: "live" } }));
  await page.reload();
  await expect(page.locator(rows)).toHaveCount(10);
  await expect(page.getByText("Демо-режим AI.")).toHaveCount(0);
});

test("DEV-005 AC-10 AC-11: dev controls display forced states and persist serious mode", async ({ page }) => {
  await page.goto("/");
  const opener = page.getByRole("button", { name: "Стани прототипу" });
  await opener.click();
  const panel = page.getByRole("dialog", { name: "Стани прототипу" });
  await panel.getByRole("radio", { name: "Помилка" }).check();
  await panel.getByRole("button", { name: "Готово" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Не вдалося завантажити задачі");

  await opener.click();
  await panel.getByRole("checkbox", { name: "Серйозний режим" }).check();
  await panel.getByRole("radio", { name: "Порожньо" }).check();
  await panel.getByRole("button", { name: "Готово" }).click();
  await expect(page.getByRole("heading", { name: "Поки що задач немає" })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("task-summary")).toContainText("3 гарячі");
  await expect(page.getByTestId("task-summary")).not.toContainText("🌶️");
  const legend = page.getByRole("button", { name: "Температура задач: легенда" });
  await legend.click();
  await expect(page.getByRole("columnheader", { name: "Підпис" })).toHaveCount(0);
});
