import { expect, test } from "@playwright/test";

test("DEV-001 AC-1: /api/health повертає status ok і aiMode demo", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", aiMode: "demo" });
});
