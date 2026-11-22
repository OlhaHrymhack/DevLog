import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const databaseDir = process.env.DEVLOG_PLAYWRIGHT_DB_DIR ??= mkdtempSync(join(tmpdir(), "devlog-playwright-"));

// API contract and theme persistence do not depend on the viewport: run them once, in desktop-1280 only.
const CRUD_SPEC = /taskCrud\.spec\.ts/;
const DETAILS_SPEC = /taskDetails\.spec\.ts/;
const DAY_PLAN_SPEC = /dayPlan\.spec\.ts/;
const DECOMPOSE_SPEC = /decompose\.spec\.ts/;
const SINGLE_VIEWPORT_SPECS = /(health|theme|tasksList)\.spec\.ts/;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run db:seed && npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    env: {
      AI_MODE: "demo",
      DATABASE_URL: `file:${join(databaseDir, "test.db")}`,
      DEVLOG_PLAYWRIGHT: "1",
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "mobile-375",
      dependencies: ["desktop-1280"],
      testIgnore: [SINGLE_VIEWPORT_SPECS, CRUD_SPEC, DAY_PLAN_SPEC, DECOMPOSE_SPEC],
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } },
    },
    {
      name: "tablet-768",
      dependencies: ["desktop-1280"],
      testIgnore: [SINGLE_VIEWPORT_SPECS, CRUD_SPEC, DAY_PLAN_SPEC, DECOMPOSE_SPEC],
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
    },
    {
      name: "desktop-1280",
      testIgnore: [CRUD_SPEC, DETAILS_SPEC, DAY_PLAN_SPEC, DECOMPOSE_SPEC],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      // Details scenarios create their own tasks, so they run after suites that assert exact counts for the original seed.
      name: "details-desktop-1280",
      dependencies: ["desktop-1280"],
      testMatch: DETAILS_SPEC,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      // Mutations run after suites that assert exact counts for the original seed.
      name: "crud",
      dependencies: ["mobile-375", "tablet-768", "details-desktop-1280"],
      testMatch: CRUD_SPEC,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      // The plan agent changes the day focus and ranks every active task, so it runs after suites that mutate or count tasks.
      name: "day-plan",
      dependencies: ["crud"],
      testMatch: DAY_PLAN_SPEC,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      // Decomposition creates its own tasks and subtasks, so it runs after every suite that counts or mutates tasks.
      name: "decompose",
      dependencies: ["day-plan"],
      testMatch: DECOMPOSE_SPEC,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
});
