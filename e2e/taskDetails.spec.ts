import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { z } from "zod";

const created = z.object({ data: z.object({ id: z.string() }) });
const description = "Опис задачі для перевірки сторінки деталей: достатньо довгий текст.";

const seedTask = async (request: APIRequestContext, title: string, subtasks: string[] = []) => {
  const response = await request.post("/api/tasks", { data: { title, description, priority: "medium" } });
  expect(response.status()).toBe(201);
  const { id } = created.parse(await response.json()).data;
  if (subtasks.length > 0) {
    const added = await request.post(`/api/tasks/${id}/subtasks`, {
      data: { items: subtasks.map((item, index) => ({ title: item, source: index === 0 ? "ai" : "user" })) },
    });
    expect(added.status()).toBe(201);
  }
  return id;
};

const staleDetail = z.object({ data: z.object({ updatedAt: z.string() }).passthrough() }).passthrough();
const STALE_DAYS = 8;

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

test("DEV-007 AC-1: клік по задачі у списку відкриває її деталі", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Виправити витік пам’яті у воркері нотифікацій" }).click();
  await expect(page).toHaveURL(/\/tasks\/t1$/);

  await expect(page.getByRole("heading", { level: 1, name: "Виправити витік пам’яті у воркері нотифікацій" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Статус" })).toHaveValue("in-progress");
  await expect(page.getByRole("combobox", { name: "Пріоритет" })).toHaveValue("high");
  await expect(page.getByText("Гаряча", { exact: true })).toBeVisible();
  await expect(page.getByText("Після деплою 2.14 RSS воркера")).toBeVisible();
  await expect(page.getByText("2 з 2 готово")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Відтворити витік на staging" })).toBeChecked();
  await expect(page.getByText("Причина: слухачі на 'message'")).toBeVisible();
});

test("DEV-007 AC-2: статус і пріоритет змінюються з деталей, список оновлюється", async ({ page, request }, info) => {
  const title = `Деталі: статус ${info.project.name}`;
  const id = await seedTask(request, title);
  try {
    await page.goto(`/tasks/${id}`);
    await page.getByRole("combobox", { name: "Статус" }).selectOption("in-progress");
    await expect(page.getByText("Статус: В роботі")).toBeVisible();
    await page.getByRole("combobox", { name: "Пріоритет" }).selectOption("high");
    await expect(page.getByText("Пріоритет: Високий")).toBeVisible();
    await page.getByRole("combobox", { name: "Статус" }).selectOption("done");
    await expect(page.getByText("Статус: Готово")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Статус" })).toHaveValue("done");
    await expect(page.getByRole("combobox", { name: "Пріоритет" })).toHaveValue("high");

    await page.getByRole("link", { name: "Задачі", exact: true }).click();
    await page.getByRole("searchbox", { name: "Пошук задач" }).fill(title);
    const row = page.locator("[data-slot='task-row']").filter({ hasText: title });
    await expect(row).toContainText("Готово");
    await expect(row.getByRole("link", { name: title })).toHaveCSS("text-decoration-line", "line-through");
  } finally {
    await request.delete(`/api/tasks/${id}`);
  }
});

test("DEV-007 AC-3, DEV-019 AC-3: створення, виконання й видалення підзадач та бейдж AI", async ({ page, request }, info) => {
  const id = await seedTask(request, `Деталі: підзадачі ${info.project.name}`, ["Перша від агента", "Друга", "Третя"]);
  try {
    await page.goto(`/tasks/${id}`);
    await expect(page.getByText("0 з 3 готово")).toBeVisible();
    await expect(page.getByText("✦ AI")).toHaveCount(1);

    const first = page.getByRole("checkbox", { name: "Перша від агента" });
    await first.click();
    await expect(page.getByText("1 з 3 готово")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Прогрес підзадач" })).toHaveAttribute("aria-valuenow", "33");
    await first.click();
    await expect(page.getByText("0 з 3 готово")).toBeVisible();

    for (const name of ["Перша від агента", "Друга", "Третя"]) {
      await page.getByRole("checkbox", { name }).click();
      await expect(page.getByRole("checkbox", { name })).toBeChecked();
    }
    await expect(page.getByText(/Усі підзадачі готові/)).toBeVisible();

    await page.getByRole("button", { name: "Видалити підзадачу «Друга»" }).click();
    await expect(page.getByText("Підзадачу видалено")).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Друга" })).toHaveCount(0);
    await expect(page.getByText("2 з 2 готово")).toBeVisible();

    const newSubtask = page.getByRole("textbox", { name: "Нова підзадача" });
    const addButton = page.getByRole("button", { name: "Додати підзадачу" });
    await expect(addButton).toBeDisabled();
    await newSubtask.fill("Перевірити на телефоні");
    await addButton.click();
    await expect(page.getByText("2 з 3 готово")).toBeVisible();
    await expect(newSubtask).toHaveValue("");
    await page.reload();
    const added = page.getByRole("checkbox", { name: "Перевірити на телефоні" });
    await expect(added).toBeVisible();
    await expect(added).not.toBeChecked();
    await expect(page.getByText("✦ AI")).toHaveCount(1);
  } finally {
    await request.delete(`/api/tasks/${id}`);
  }
});

test("DEV-007 AC-4: нотатки — порожня відхиляється з фокусом, валідна додається", async ({ page, request }, info) => {
  const id = await seedTask(request, `Деталі: нотатки ${info.project.name}`);
  try {
    await page.goto(`/tasks/${id}`);
    await expect(page.getByText("Нотаток немає")).toBeVisible();
    const field = page.getByRole("textbox", { name: "Нова нотатка" });
    await page.getByRole("button", { name: "Додати нотатку" }).click();
    await expect(page.getByText("Нотатка порожня")).toBeVisible();
    await expect(field).toBeFocused();

    await field.fill("Перевірено на staging, чекає ревʼю");
    await page.getByRole("button", { name: "Додати нотатку" }).click();
    await expect(page.getByText("Нотатку додано")).toBeVisible();
    await expect(page.getByText("Перевірено на staging, чекає ревʼю")).toBeVisible();
    await expect(page.getByText("сьогодні", { exact: true }).first()).toBeVisible();
    await expect(field).toHaveValue("");
  } finally {
    await request.delete(`/api/tasks/${id}`);
  }
});

test("DEV-007 AC-4: нова нотатка оновлює updatedAt і знімає «Тепленьку» температуру", async ({ page, request }, info) => {
  const id = await seedTask(request, `Деталі: температура ${info.project.name}`);
  let noteSent = false;
  await page.route(`**/api/tasks/${id}`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const body = staleDetail.parse(await response.json());
    if (!noteSent) body.data.updatedAt = new Date(Date.now() - STALE_DAYS * 24 * 3_600_000).toISOString();
    return route.fulfill({ response, json: body });
  });
  try {
    await page.goto(`/tasks/${id}`);
    await expect(page.getByText("Тепленька", { exact: true }).first()).toBeVisible();

    noteSent = true;
    await page.getByRole("textbox", { name: "Нова нотатка" }).fill("Повернувся до задачі");
    await page.getByRole("button", { name: "Додати нотатку" }).click();
    await expect(page.getByText("Нотатку додано")).toBeVisible();
    await expect(page.getByText("Свіжа", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Тепленька", { exact: true })).toHaveCount(0);
  } finally {
    await request.delete(`/api/tasks/${id}`);
  }
});

test("DEV-007 AC-5: відсутня задача і помилка завантаження з повтором", async ({ page }) => {
  await page.goto("/tasks/nope");
  await expect(page.getByText("Задачу не знайдено")).toBeVisible();
  await page.getByRole("link", { name: "До списку" }).click();
  await expect(page).toHaveURL(/\/$/);

  let failing = true;
  await page.route("**/api/tasks/t2", async (route) => {
    if (failing) await route.fulfill({ status: 500, json: { error: { code: "INTERNAL", message: "Помилка" } } });
    else await route.continue();
  });
  await page.goto("/tasks/t2");
  await expect(page.getByText("Не вдалося завантажити задачу")).toBeVisible();
  await expect(page.getByText("GET /api/tasks/t2 → 500")).toBeVisible();
  failing = false;
  await page.getByRole("button", { name: "Спробувати ще раз" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Міграція auth на нові токени" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Міграція auth на нові токени" }).getByText(/дедлайн/)).toBeVisible();
});

test("DEV-007 AC-6: на tablet і mobile — вкладки, ?tab=decompose, aria-selected", async ({ page }) => {
  test.skip(isDesktop(page), "Вкладки лише нижче 1024 px");
  await page.goto("/tasks/t1");
  const tabs = page.getByRole("tablist");
  await expect(tabs.getByRole("tab", { name: "Задача" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await tabs.getByRole("tab", { name: "Підзадачі" }).click();
  await expect(page).toHaveURL(/tab=decompose/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Декомпозиція" })).toBeVisible();

  await page.goto("/tasks/t1?tab=decompose");
  await expect(tabs.getByRole("tab", { name: "Підзадачі" })).toHaveAttribute("aria-selected", "true");
  await tabs.getByRole("tab", { name: "Підзадачі" }).focus();
  await page.keyboard.press("ArrowRight");
  const updateTab = tabs.getByRole("tab", { name: "Апдейт" });
  await expect(updateTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("region", { name: "Статус-апдейт" })).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(updateTab).not.toBeFocused();
  await expect(updateTab).toHaveAttribute("aria-selected", "true");

  await updateTab.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(tabs.getByRole("tab", { name: "Підзадачі" })).toHaveAttribute("aria-selected", "true");
});

test("DEV-007 AC-7: видалення з деталей повертає до списку", async ({ page, request }, info) => {
  const title = `Деталі: видалення ${info.project.name}`;
  const id = await seedTask(request, title);
  await page.goto(`/tasks/${id}`);
  await page.getByRole("button", { name: "Видалити", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Видалити задачу?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Видалити", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(/Видалено|Задачу видалено/)).toBeVisible();
  expect((await request.get(`/api/tasks/${id}`)).status()).toBe(404);
});
