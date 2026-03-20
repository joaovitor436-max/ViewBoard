import { test, expect } from "@playwright/test";

/**
 * Pre-flight check: ensure the API is healthy before running any other tests.
 */
test.describe("API setup", () => {
  test("API is reachable and healthy", async ({ request }) => {
    // The Fastify server should respond at the root or a health endpoint.
    // Try common patterns; adjust if ViewBoard exposes a specific route.
    const res = await request.get("/", { failOnStatusCode: false });

    // Accept 200, 404 (no root route but server is up), or a docs redirect
    expect([200, 302, 404]).toContain(res.status());
  });
});
