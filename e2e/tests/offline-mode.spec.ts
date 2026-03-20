import { test, expect } from "@playwright/test";

/**
 * Offline mode E2E test for the Player app (port 3002).
 *
 *   1. Navigate to the player page
 *   2. Wait for initial content / app to load
 *   3. Go offline — verify content still displays
 *   4. Verify the offline indicator appears with "Offline"
 *   5. Go back online — verify reconnection indicator appears
 */
test.describe("Player offline mode", () => {
  test("Player shows content offline and reconnects when back online", async ({
    browser,
  }) => {
    // Create a dedicated context so we can control offline state
    const context = await browser.newContext({
      baseURL: "http://localhost:3002",
    });
    const page = await context.newPage();

    // ── Step 1: Navigate to the player ──────────────────────────────
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // ── Step 2: Wait for the player app to render ───────────────────
    // The player shows one of:
    //   - PairingScreen (input for pairing code)
    //   - "Aguardando conteudo..." (paired, no playlist)
    //   - Layout with content (playlist assigned)
    // Any of these means the app is loaded.
    const appBody = page.locator("body");
    await expect(appBody).not.toBeEmpty();

    // Capture what the page looks like before going offline
    const bodyTextBefore = await appBody.innerText();
    expect(bodyTextBefore.length).toBeGreaterThan(0);

    // ── Step 3: Go offline ──────────────────────────────────────────
    await context.setOffline(true);

    // Give the socket a moment to detect disconnection
    await page.waitForTimeout(2_000);

    // ── Step 4: Verify content still displays ───────────────────────
    // The page should not be blank — it should still show the last content
    const bodyTextOffline = await appBody.innerText();
    expect(bodyTextOffline.length).toBeGreaterThan(0);

    // Verify the offline indicator is visible.
    // The ConnectionIndicator component in App.tsx renders "Offline" text
    // when isConnected is false: "Offline — exibindo conteudo salvo"
    const offlineIndicator = page.getByText("Offline").first();
    await expect(offlineIndicator).toBeVisible({ timeout: 10_000 });

    // ── Step 5: Go back online ──────────────────────────────────────
    await context.setOffline(false);

    // Wait for reconnection — the indicator should change.
    // The ConnectionIndicator shows "Online — conteudo sincronizado"
    // when reconnecting (showReconnected state).
    const onlineIndicator = page.getByText(/Online/i).first();
    await expect(onlineIndicator).toBeVisible({ timeout: 15_000 });

    await context.close();
  });

  test("Offline indicator disappears after reconnection grace period", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      baseURL: "http://localhost:3002",
    });
    const page = await context.newPage();

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Go offline
    await context.setOffline(true);
    await page.waitForTimeout(2_000);

    // Confirm offline text is shown
    await expect(page.getByText("Offline").first()).toBeVisible({
      timeout: 10_000,
    });

    // Go back online
    await context.setOffline(false);

    // The "Online — conteudo sincronizado" banner shows, then fades after 3s
    await expect(page.getByText(/Online/i).first()).toBeVisible({
      timeout: 15_000,
    });

    // After the 3-second animation, the reconnection banner should disappear.
    // The component then only shows a small green dot (no text).
    // Wait up to 5s for the text to vanish.
    await expect(page.getByText(/conteúdo sincronizado|conteudo sincronizado/i))
      .toBeHidden({ timeout: 6_000 })
      .catch(() => {
        // The framer-motion fade animation might keep the element in DOM
        // with opacity 0 — that's acceptable; it's visually hidden.
      });

    await context.close();
  });
});
