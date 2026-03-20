import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for the ViewBoard monorepo.
 *
 * Apps:
 *   - dashboard  (Next.js)  → http://localhost:3000
 *   - player     (Vite)     → http://localhost:3002
 *   - api        (Fastify)  → http://localhost:3001
 */

const CI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // tests share state (login, uploaded media)
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: 1,
  reporter: CI ? [["html", { open: "never" }], ["github"]] : [["html"]],

  /* Shared settings applied to every project */
  use: {
    headless: true,
    screenshot: "only-on-failure",
    video: CI ? "retain-on-failure" : "off",
    trace: CI ? "retain-on-failure" : "on-first-retry",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  timeout: 60_000,
  expect: { timeout: 10_000 },

  projects: [
    /* ── API health-check (runs first) ─────────────────────────────── */
    {
      name: "api-setup",
      testMatch: /.*setup\.spec\.ts/,
      use: {
        baseURL: "http://localhost:3001",
      },
    },

    /* ── Dashboard tests ───────────────────────────────────────────── */
    {
      name: "dashboard",
      dependencies: ["api-setup"],
      testMatch: /.*(?<!offline-mode)\.spec\.ts/,
      testIgnore: /.*setup\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:3000",
      },
    },

    /* ── Player tests ──────────────────────────────────────────────── */
    {
      name: "player",
      dependencies: ["api-setup"],
      testMatch: /.*offline-mode\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:3002",
      },
    },
  ],

  /* Start the three apps before running tests (local dev only) */
  webServer: CI
    ? undefined
    : [
        {
          command: "pnpm --filter @viewboard/api dev",
          port: 3001,
          reuseExistingServer: true,
          cwd: "..",
          timeout: 30_000,
        },
        {
          command: "pnpm --filter @viewboard/dashboard dev",
          port: 3000,
          reuseExistingServer: true,
          cwd: "..",
          timeout: 30_000,
        },
        {
          command: "pnpm --filter @viewboard/player dev",
          port: 3002,
          reuseExistingServer: true,
          cwd: "..",
          timeout: 30_000,
        },
      ],
});
