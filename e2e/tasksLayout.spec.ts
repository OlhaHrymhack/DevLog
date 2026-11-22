import { expect, test } from "@playwright/test";

test("DEV-005 AC-7: task layout switches between table and card columns without page overflow", async ({ page }, testInfo) => {
  await page.goto("/");
  const list = page.getByTestId("task-list");
  await expect(list.locator("[data-slot='task-row']")).toHaveCount(10);
  const width = page.viewportSize()?.width ?? 0;
  const headers = list.getByRole("columnheader");
  if (width >= 1024) {
    await expect(headers).toHaveCount(6);
    const titleHeader = await headers.first().boundingBox();
    const titleCell = await list.getByRole("cell").first().boundingBox();
    expect(titleHeader?.x).toBe(titleCell?.x);
    await expect(page.getByRole("button", { name: "Нова задача" })).toBeVisible();
  } else {
    await expect(headers).toHaveCount(6);
    await expect(list.getByRole("row").first()).toHaveCSS("position", "absolute");
    const related = await list.locator("[data-slot='task-row']").evaluateAll((items) =>
      items.slice(0, 2).map((item) => item.getBoundingClientRect().top));
    if (width >= 768) expect(related[0]).toBe(related[1]);
    else {
      expect(related[0]).toBeLessThan(related[1] ?? 0);
      const fab = page.locator("main + button");
      await expect(fab).toBeVisible();
      await expect(fab).toHaveCSS("width", "56px");
      await expect(fab).toHaveCSS("height", "56px");
      await expect(page.locator("header").getByRole("button", { name: "Нова задача" })).toBeHidden();
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({ path: testInfo.outputPath("tasks-list.png"), animations: "disabled" });
});

test("DEV-005 AC-7: narrow desktop fits the table and the hottest badge", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280");
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");
  const list = page.getByTestId("task-list");
  const alarm = list.locator("[data-slot='task-row'][data-heat='alarm']");
  await expect(alarm).toBeVisible();
  const cells = await alarm.getByRole("cell").evaluateAll((elements) =>
    elements.map((cell) => ({ width: cell.clientWidth, contentWidth: cell.scrollWidth })));
  expect(cells).toHaveLength(6);
  for (const cell of cells) expect(cell.contentWidth).toBeLessThanOrEqual(cell.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1024);
});
