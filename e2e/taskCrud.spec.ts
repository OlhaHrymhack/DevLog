import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { z } from "zod";

const taskId = z.object({ data: z.object({ id: z.string() }) });
const collection = /^.*\/api\/tasks(?:\?|$)/;
const rows = "[data-slot='task-row']";
const description = "Додати повний сценарій перевірки процесу створення і зміни задачі.";
const selectNewest = (page: Page) =>
  page.getByRole("combobox", { name: "Сортування" }).selectOption("date-desc");

const seedTask = async (request: APIRequestContext, title: string) => {
  const response = await request.post("/api/tasks", {
    data: { title, description, priority: "high", dueAt: new Date(Date.now() + 3_600_000).toISOString() },
  });
  expect(response.status()).toBe(201);
  return taskId.parse(await response.json()).data.id;
};

test("DEV-006 AC-1 / DEV-016 AC-1: creates a task through the API and shows it first under newest sorting", async ({ page, request }, info) => {
  const title = `Перевірити створення задачі ${info.retry}`;
  await page.goto("/");
  await selectNewest(page);
  const opener = page.getByRole("button", { name: "Нова задача", exact: true });
  await opener.click();
  const form = page.getByRole("dialog", { name: "Нова задача" });
  await expect(form.getByRole("textbox", { name: "Назва *" })).toBeFocused();
  await expect(form.getByRole("button", { name: "Спробувати приклад" })).toBeEnabled();
  await expect(form.getByText("Скажіть, що зробити", { exact: false })).toBeVisible();
  await form.getByRole("textbox", { name: "Назва *" }).fill(title);
  await form.getByRole("textbox", { name: "Опис *" }).fill(description);
  await expect(form.getByText("Опис короткий", { exact: false })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("task-create-desktop.png"), animations: "disabled" });
  const created = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/tasks" && response.request().method() === "POST");
  await form.getByRole("button", { name: "Створити" }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const { data } = taskId.parse(await response.json());
  try {
    await expect(form).toBeHidden();
    await expect(page.locator(rows).first()).toContainText(title);
    await expect(page.getByText(/Задачу створено/)).toBeVisible();
    await expect(opener).toBeFocused();
  } finally {
    await request.delete(`/api/tasks/${data.id}`);
  }
});

test("DEV-006 AC-2 AC-3: validation focuses fields and API failures retain input", async ({ page }) => {
  let attempts = 0;
  await page.route(collection, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    attempts++;
    if (attempts === 1) {
      return route.fulfill({ status: 400, json: { error: {
        code: "VALIDATION_ERROR", message: "Невалідні поля", details: { fieldErrors: { title: ["Змініть назву задачі."] } },
      } } });
    }
    return route.fulfill({ status: 500, json: { error: { code: "INTERNAL_ERROR", message: "Помилка" } } });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Нова задача", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Нова задача" });
  const title = dialog.getByRole("textbox", { name: "Назва *" });
  const details = dialog.getByRole("textbox", { name: "Опис *" });
  const submit = dialog.getByRole("button", { name: "Створити" });
  await submit.click();
  await expect(title).toBeFocused();
  await expect(title).toHaveAttribute("aria-invalid", "true");
  await expect(details).toHaveAttribute("aria-invalid", "true");
  expect(attempts).toBe(0);

  await title.fill("Виправити форму");
  await expect(title).toBeFocused();
  await details.fill("Стислий опис.");
  await expect(dialog.getByText(/Опис короткий/)).toBeVisible();
  await submit.click();
  await expect(dialog.getByText("Змініть назву задачі.")).toBeVisible();
  await expect(title).toBeFocused();
  await title.fill("Виправити назву форми");
  await submit.click();
  await expect(page.getByText("Не вдалося зберегти. Спробуйте ще раз")).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(title).toHaveValue("Виправити назву форми");
  await expect(details).toHaveValue("Стислий опис.");
  expect(attempts).toBe(2);
});

test("DEV-006 AC-4: prefilled edit sends only changed fields and updates the list", async ({ page, request }, info) => {
  const title = `Перевірити редагування задачі ${info.retry}`;
  const id = await seedTask(request, title);
  try {
    await page.goto("/");
    await selectNewest(page);
    const opener = page.getByRole("button", { name: `Редагувати: ${title}`, exact: true });
    await opener.click();
    const form = page.getByRole("dialog", { name: "Редагувати задачу" });
    await expect(form.getByRole("textbox", { name: "Назва *" })).toHaveValue(title);
    await expect(form.getByRole("textbox", { name: "Опис *" })).toHaveValue(description);
    await expect(form.getByText(/Дата створення не редагується/)).toBeVisible();
    await form.getByText("Низький", { exact: true }).click();
    await page.screenshot({ path: info.outputPath("task-edit-desktop.png"), animations: "disabled" });
    const patched = page.waitForResponse((response) =>
      new URL(response.url()).pathname === `/api/tasks/${id}` && response.request().method() === "PATCH");
    await form.getByRole("button", { name: "Зберегти" }).click();
    const response = await patched;
    expect(response.ok()).toBe(true);
    expect(response.request().postDataJSON()).toEqual({ priority: "low" });
    await expect(form).toBeHidden();
    await expect(page.locator(rows).filter({ hasText: title })).toContainText("Низький");
    await expect(page.getByText("Зміни збережено", { exact: true })).toBeVisible();
    await expect(opener).toBeFocused();
  } finally {
    await request.delete(`/api/tasks/${id}`);
  }
});

test("DEV-006 AC-5: delete shows real counts, cancels safely, then deletes and restores focus", async ({ page, request }, info) => {
  const title = `Перевірити видалення задачі ${info.retry}`;
  const id = await seedTask(request, title);
  try {
    expect((await request.post(`/api/tasks/${id}/subtasks`, {
      data: { items: [
        { title: "Перша підзадача", source: "user" },
        { title: "Друга підзадача", source: "user" },
      ] },
    })).status()).toBe(201);
    expect((await request.post(`/api/tasks/${id}/notes`, {
      data: { text: "Тестова нотатка" },
    })).status()).toBe(201);
    await page.goto("/");
    await selectNewest(page);
    const opener = page.getByRole("button", { name: `Видалити: ${title}`, exact: true });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Видалити задачу?" });
    const confirm = dialog.getByRole("button", { name: "Видалити", exact: true });
    await expect(dialog).toHaveAccessibleDescription(`«${title}» буде видалено разом із 2 підзадачами і 1 нотаткою. Цю дію не можна скасувати.`);
    await expect(confirm).toBeFocused();
    await page.screenshot({ path: info.outputPath("task-delete-desktop.png"), animations: "disabled" });
    await dialog.getByRole("button", { name: "Скасувати" }).click();
    await expect(opener).toBeFocused();
    expect((await request.get(`/api/tasks/${id}`)).ok()).toBe(true);
    await opener.click();
    await confirm.click();
    await expect(dialog).toBeHidden();
    await expect(opener).toHaveCount(0);
    await expect(page.getByText(/Видалено\. Ніхто й не помітить/)).toBeVisible();
    await expect(page.locator("#main")).toBeFocused();
    expect((await request.get(`/api/tasks/${id}`)).status()).toBe(404);
  } finally {
    await request.delete(`/api/tasks/${id}`);
  }
});

test("DEV-006 AC-6: Escape closes the modal, Tab stays inside, and keyboard shortcuts work", async ({ page }) => {
  await page.goto("/");
  const opener = page.getByRole("button", { name: "Нова задача", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Нова задача" });
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog).toHaveAttribute("aria-labelledby", /.+/);
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press("Tab");
    await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await page.keyboard.press("N");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  // Playwright's physical key map does not include Cyrillic characters.
  await opener.dispatchEvent("keydown", { key: "Т", bubbles: true });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("DEV-006 AC-7 / DEV-016 AC-1: mobile FAB opens a bottom sheet with actions visible at reduced height", async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const opener = page.getByRole("button", { name: "Нова задача", exact: true });
  await opener.click();
  const sheet = page.getByRole("dialog", { name: "Нова задача" });
  await expect(sheet).toHaveAttribute("data-slot", "sheet-content");
  await expect(sheet.getByText("може зачекати", { exact: false })).toBeVisible();
  await page.screenshot({ path: info.outputPath("task-create-mobile.png"), animations: "disabled" });
  await page.setViewportSize({ width: 375, height: 440 });
  const save = sheet.getByRole("button", { name: "Створити" });
  const cancel = sheet.getByRole("button", { name: "Скасувати" });
  await expect(save).toBeInViewport({ ratio: 1 });
  await expect(cancel).toBeInViewport({ ratio: 1 });
  await cancel.click();
  await expect(sheet).toBeHidden();
  await expect(opener).toBeFocused();
});

test("DEV-016 AC-3 / DEV-016 AC-6: demo voice draft is editable, saved on confirmation and its deadline can be cleared", async ({ page, request }) => {
  const localNoon = await page.evaluate(() => new Date(2026, 10, 23, 12).getTime());
  await page.clock.setFixedTime(localNoon);
  let creationAttempts = 0;
  page.on("request", (outgoing) => {
    if (new URL(outgoing.url()).pathname === "/api/tasks" && outgoing.method() === "POST") creationAttempts++;
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () => { throw new Error("Demo must work without microphone access"); },
    });
  });

  await page.goto("/");
  await selectNewest(page);
  await page.getByRole("button", { name: "Нова задача", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Нова задача" });
  const title = dialog.getByRole("textbox", { name: "Назва *" });
  const dueAt = dialog.getByLabel("Дедлайн");
  await dialog.getByRole("button", { name: "Спробувати приклад" }).click();
  await expect(dialog.getByRole("status")).toContainText("Чернетка готова");
  await expect(title).toHaveValue("Виправити зникнення аватара");
  await expect(dialog.getByRole("textbox", { name: "Опис *" })).toHaveValue(/після оновлення профілю/);
  await expect(dialog.getByRole("radio", { name: "Високий" })).toBeChecked();
  await expect(dueAt).toHaveValue("2026-11-24T17:00");
  expect(creationAttempts).toBe(0);

  const expectedDueAt = await dueAt.evaluate((input) => {
    if (!(input instanceof HTMLInputElement)) throw new Error("Expected deadline input");
    return new Date(input.value).toISOString();
  });
  const editedTitle = "Виправити аватар після зміни профілю";
  await title.fill(editedTitle);
  const created = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/tasks" && response.request().method() === "POST");
  await dialog.getByRole("button", { name: "Створити", exact: true }).click();

  const response = await created;
  expect(response.status()).toBe(201);
  const { data } = taskId.parse(await response.json());
  const taskUrl = `/api/tasks/${data.id}`;
  try {
    expect(await (await request.get(taskUrl)).json()).toMatchObject({
      data: { title: editedTitle, priority: "high", dueAt: expectedDueAt },
    });
    await page.getByRole("button", { name: `Редагувати: ${editedTitle}`, exact: true }).click();
    const editor = page.getByRole("dialog", { name: "Редагувати задачу" });
    await expect(editor.getByLabel("Дедлайн")).toHaveValue("2026-11-24T17:00");
    await editor.getByLabel("Дедлайн").fill("");
    await editor.getByRole("button", { name: "Зберегти" }).click();
    await expect(editor).toBeHidden();
    expect(await (await request.get(taskUrl)).json()).toMatchObject({ data: { dueAt: null } });
  } finally {
    await request.delete(taskUrl);
  }
});
