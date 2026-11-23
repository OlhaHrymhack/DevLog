import { expect, test } from "@playwright/test";

test("DEV-001 AC-1: /api/health повертає status ok і aiMode demo", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", aiMode: "demo" });
});

test("DEV-017 AC-7: демодані доступні відвідувачу без входу", async ({ page, request }) => {
  const response = await request.get("/api/tasks?q=Міграція");
  expect(response.ok()).toBe(true);
  const { data } = await response.json();
  expect(data).toEqual(expect.arrayContaining([
    expect.objectContaining({ title: expect.stringContaining("Міграція auth") }),
  ]));

  await page.goto("/");
  await expect(page.getByText("Демо-режим AI", { exact: false }).first()).toBeVisible();
  await expect(page.locator("[data-slot='task-row']").filter({ hasText: "Міграція auth" })).toBeVisible();
});
