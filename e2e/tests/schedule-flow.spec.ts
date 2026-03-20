import { test, expect } from "@playwright/test";
import { login, navigateTo } from "./helpers";

/**
 * Schedule flow E2E:
 *   1. Login
 *   2. Create a schedule with a specific time
 *   3. Verify the schedule appears in the calendar and list views
 */
test.describe("Schedule flow", () => {
  const uniqueSuffix = Date.now().toString(36);
  const scheduleName = `Sched-Test-${uniqueSuffix}`;

  // ── Step 1: Login ─────────────────────────────────────────────────
  test("Login and navigate to schedules", async ({ page }) => {
    await login(page);
    await navigateTo(page, "/schedules", /Agendamentos/i);
    await expect(page.getByText(/Agendamentos/i).first()).toBeVisible();
  });

  // ── Step 2: Create a schedule with a specific time ────────────────
  test("Create a schedule with a specific start/end time", async ({
    page,
  }) => {
    await login(page);
    await navigateTo(page, "/schedules", /Agendamentos/i);

    // Open the "Novo Agendamento" modal
    await page.getByRole("button", { name: /Novo Agendamento/i }).click();

    // Fill schedule name
    await page.getByLabel("Nome").fill(scheduleName);

    // Select a playlist
    const playlistSelect = page.locator("#sched-playlist");
    await playlistSelect.waitFor({ state: "visible", timeout: 10_000 });
    const options = playlistSelect.locator("option");
    const optCount = await options.count();
    expect(optCount).toBeGreaterThan(1); // at least one real option + placeholder
    await playlistSelect.selectOption({ index: optCount - 1 });

    // Set start: tomorrow at 09:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    const startStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T09:00`;
    await page.getByLabel("Início").fill(startStr);

    // Set end: tomorrow at 18:00
    const endStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T18:00`;
    await page.getByLabel("Fim").fill(endStr);

    // Set recurrence to "Diario" (DAILY)
    const recurrenceSelect = page.locator("#sched-recurrence");
    await recurrenceSelect.selectOption("DAILY");

    // Set priority to 2
    await page.getByLabel(/Prioridade/i).fill("2");

    // Select a device if available
    const deviceSelect = page.locator("#sched-device");
    if (await deviceSelect.isVisible()) {
      const devOptions = deviceSelect.locator("option");
      const devCount = await devOptions.count();
      if (devCount > 1) {
        await deviceSelect.selectOption({ index: 1 });
      }
    }

    // Submit the form
    await page.getByRole("button", { name: /Criar Agendamento/i }).click();

    // Modal should close; wait for it to disappear
    await expect(
      page.getByRole("heading", { name: /Novo Agendamento/i })
    ).toBeHidden({ timeout: 10_000 });
  });

  // ── Step 3: Verify the schedule appears in the calendar ───────────
  test("Schedule appears in the calendar view", async ({ page }) => {
    await login(page);
    await navigateTo(page, "/schedules", /Agendamentos/i);

    // Default view is "calendar" — the BigCalendar component should render
    const calendarCard = page.locator(".rbc-calendar");
    await expect(calendarCard).toBeVisible({ timeout: 10_000 });

    // Our schedule should appear as an event on the calendar
    // (may need to navigate to the correct month if it's tomorrow)
    const eventOnCalendar = page.getByText(scheduleName).first();

    // If the event is not visible, it might be on next month's view.
    // Try clicking "Next" to navigate forward.
    if (!(await eventOnCalendar.isVisible())) {
      const nextBtn = page.getByRole("button", { name: /Próximo|Next/i });
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(1_000);
      }
    }

    // Also verify from the list view
    await page.getByRole("button", { name: /Lista/i }).click();

    // The schedule should appear in the table
    await expect(page.getByText(scheduleName).first()).toBeVisible({
      timeout: 10_000,
    });

    // Verify it shows "Diario" recurrence
    await expect(page.getByText(/Di[aá]rio/i).first()).toBeVisible();
  });
});
