import { expect, test, type Page } from "@playwright/test";

const SECTIONS = ["Button", "Badges", "Heat", "TaskRow", "Agent", "EmptyState", "Dialog"];
const THEMES = ["dark", "light"] as const;

async function openKit(page: Page, theme: (typeof THEMES)[number]) {
  await page.addInitScript((value) => localStorage.setItem("devlog-theme", value), theme);
  const response = await page.goto("/ui-kit");
  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

for (const theme of THEMES) {
  test(`DEV-002 AC-6: /ui-kit показує всі секції (${theme})`, async ({ page }) => {
    await openKit(page, theme);
    for (const name of SECTIONS) {
      await expect(page.getByRole("heading", { name, exact: true, level: 2 })).toBeVisible();
    }
  });

  test(`DEV-002 AC-7: без горизонтального скролу (${theme})`, async ({ page }) => {
    await openKit(page, theme);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("DEV-002 AC-6: діалог з /ui-kit відкривається й закривається по Esc", async ({ page }) => {
  await openKit(page, "dark");
  await page.getByRole("button", { name: "Відкрити діалог" }).click();
  await expect(page.getByRole("dialog", { name: "Видалити задачу?" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("DEV-002 AC-7: TaskRow — рядок таблиці ≥ 1024px, картка < 1024px", async ({ page }) => {
  await openKit(page, "dark");
  const width = page.viewportSize()?.width ?? 0;
  const row = page.locator("[data-slot=task-row]").first();
  const columns = await row.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  const borderRadius = await row.evaluate((element) => getComputedStyle(element).borderTopLeftRadius);

  if (width >= 1024) {
    expect(columns).toBe(6);
    expect(borderRadius).toBe("0px");
  } else {
    expect(columns).toBe(2);
    expect(borderRadius).not.toBe("0px");
  }
});

test("DEV-002 AC-8: prefers-reduced-motion скорочує анімацію HeatBadge fire до ~1ms", async ({ page }) => {
  await openKit(page, "dark");
  const emoji = page.locator('[data-heat="fire"] span.animate-flicker');

  expect(await emoji.evaluate((element) => getComputedStyle(element).animationDuration)).toBe("1.6s");

  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await emoji.evaluate((element) => getComputedStyle(element).animationDuration)).toBe("0.001s");
});

test("DEV-002 AC-7: alarm-рядок TaskRow має підсвітку, звичайний — ні (картка й рядок таблиці)", async ({ page }) => {
  await openKit(page, "dark");
  const width = page.viewportSize()?.width ?? 0;
  const background = (heat: string) =>
    page.locator(`[data-heat="${heat}"]`).first().evaluate((element) => getComputedStyle(element).backgroundColor);

  const alarm = await background("alarm");
  const fire = await background("fire");
  expect(alarm).not.toBe("rgba(0, 0, 0, 0)");
  expect(alarm).not.toBe(fire);
  if (width < 1024) expect(fire).not.toBe("rgba(0, 0, 0, 0)");
});

test("DEV-002 AC-7: на мобільному інтерактивні елементи мають ціль ≥ 44px", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 768, "лише для < 768px");
  await openKit(page, "dark");
  const targets = [
    page.getByRole("button", { name: "Primary", exact: true }),
    page.getByRole("button", { name: "Small", exact: true }),
    page.getByRole("button", { name: "Редагувати", exact: true }),
    page.getByRole("button", { name: /^Редагувати: / }).first(),
    page.getByRole("button", { name: /^Видалити: / }).first(),
    page.getByRole("button", { name: /^Температура: / }).first(),
  ];
  for (const target of targets) {
    const box = await target.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test("DEV-002 AC-5: tooltip HeatBadge закривається, коли курсор покинув значок", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, "hover лише на десктопі");
  await openKit(page, "dark");
  await page.locator('[data-heat="hot"] button').first().hover();
  await expect(page.getByRole("tooltip")).toBeVisible();

  await page.mouse.move(5, 5);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});

test("DEV-002 AC-5: після закриття діалогу фокус повертається на кнопку, що його відкрила", async ({ page }) => {
  await openKit(page, "dark");
  const opener = page.getByRole("button", { name: "Відкрити діалог" });
  await opener.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(opener).toBeFocused();
});
