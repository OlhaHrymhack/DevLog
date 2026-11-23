import { expect, test } from "@playwright/test";

// Контрольований потік: окремого тестового endpoint немає, Playwright перехоплює POST запуску агента.
const AGENT_API = "**/api/agents/prioritize";

const ndjson = (...events: unknown[]) => events.map((event) => JSON.stringify(event)).join("\n") + "\n";

const STREAM = ndjson(
  { type: "run", runId: "run-e2e", mode: "demo", steps: [{ label: "Зібрати задачі" }, { label: "Зважити" }, { label: "Перевірити результат" }] },
  { type: "step", index: 0, label: "Зібрати задачі", state: "run" },
  { type: "step", index: 0, label: "Зібрати задачі", state: "done", detail: "Прочитати список задач" },
  { type: "step", index: 1, label: "Зважити", state: "done" },
  { type: "step", index: 2, label: "Перевірити результат", state: "done" },
  { type: "result", status: "result", data: { taskId: "t1" } },
);

test("DEV-008 AC-9 AC-11: демо-запуск показує кроки, прогрес, демо-тег і «мок-відповідь»", async ({ page }) => {
  await page.route(AGENT_API, (route) => route.fulfill({ status: 200, contentType: "application/x-ndjson", body: STREAM }));
  await page.goto("/ui-kit");
  const panel = page.getByRole("region", { name: "Запуск агента" });
  await panel.getByRole("button", { name: "Запустити агента" }).click();

  await expect(panel.getByTestId("agent-run-summary")).toContainText("3 кроки");
  await expect(panel.getByTestId("agent-run-summary")).toContainText("мок-відповідь");
  await expect(panel.getByText("Демо · Агент A")).toBeVisible();
  await expect(panel.getByRole("listitem")).toHaveCount(3);
  await expect(panel.locator("li[data-state=done]")).toHaveCount(3);

  await panel.getByRole("button", { name: "Відхилити" }).click();
  await expect(page.getByText("Відхилено")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Запустити агента" })).toBeVisible();
});

test("DEV-008 AC-6 AC-11: «Зупинити» перериває запит і повертає панель в очікування", async ({ page }) => {
  const release = Promise.withResolvers<void>();
  await page.route(AGENT_API, async (route) => {
    await release.promise;
    await route.abort().catch(() => undefined);
  });
  await page.goto("/ui-kit");
  const panel = page.getByRole("region", { name: "Запуск агента" });
  await panel.getByRole("button", { name: "Запустити агента" }).click();

  const stop = panel.getByRole("button", { name: "Зупинити" });
  await expect(stop).toBeVisible();
  await expect(panel.getByRole("progressbar", { name: "Прогрес агента" })).toBeVisible();
  await stop.click();
  release.resolve();

  await expect(panel.getByRole("button", { name: "Запустити агента" })).toBeVisible();
  await expect(stop).toHaveCount(0);
  await expect(panel.getByRole("alert")).toHaveCount(0);
});
