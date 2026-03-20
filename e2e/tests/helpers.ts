import { type Page, expect } from "@playwright/test";

/* ── Test credentials ──────────────────────────────────────────────────
 * These match the seed user created by `pnpm db:seed` in apps/api.
 * Override via environment variables if needed.
 */
export const TEST_USER = {
  email: process.env.E2E_EMAIL ?? "admin@viewboard.com",
  password: process.env.E2E_PASSWORD ?? "admin1234",
  tenantSlug: process.env.E2E_TENANT ?? "default",
};

/**
 * Log in to the dashboard via the /login form.
 * After login the browser is redirected to /dashboard.
 */
export async function login(page: Page): Promise<void> {
  await page.goto("/login");

  // The login form has fields: tenantSlug, email, password
  await page.getByLabel("Organização").clear();
  await page.getByLabel("Organização").fill(TEST_USER.tenantSlug);
  await page.getByLabel("Email").fill(TEST_USER.email);
  await page.getByLabel("Senha").fill(TEST_USER.password);

  await page.getByRole("button", { name: /Entrar/i }).click();

  // Wait for navigation to the dashboard
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await expect(page).toHaveURL(/\/dashboard/);
}

/**
 * Create a tiny 1x1 red PNG image as a Buffer (89 bytes).
 * Useful for upload tests without needing external fixtures.
 */
export function createTestImageBuffer(): Buffer {
  // Minimal valid PNG: 1x1 pixel, RGBA, red (#FF0000FF)
  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    // IHDR chunk
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00,
    // IDAT chunk
    0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54,
    0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00,
    0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33,
    // IEND chunk
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
    0xae, 0x42, 0x60, 0x82,
  ]);
  return png;
}

/**
 * Navigate to a dashboard section via the sidebar or direct URL.
 */
export async function navigateTo(
  page: Page,
  path: string,
  heading?: string | RegExp
): Promise<void> {
  await page.goto(path);
  if (heading) {
    await expect(
      page.getByRole("heading", { name: heading }).first()
    ).toBeVisible({ timeout: 10_000 });
  }
}
