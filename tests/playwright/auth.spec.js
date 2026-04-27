const { test, expect } = require("@playwright/test");

const E2E_EMAIL = process.env.E2E_EMAIL || "amith@mail";
const E2E_PASSWORD = process.env.E2E_PASSWORD || "pass";
const INVALID_PASSWORD = "invalid-password-for-e2e";

async function login(page, email, password) {
  await page.goto("/login");
  await expect(page.locator("#login-email")).toBeVisible();
  await page.fill("#login-email", email);
  await page.fill("#login-password", password);
  await page.getByRole("button", { name: /^login$/i }).click();
}

test.describe("Authentication flow", () => {
  test.beforeEach(() => {
    test.skip(
      !E2E_EMAIL || !E2E_PASSWORD,
      "Set E2E_EMAIL and E2E_PASSWORD to run authentication Playwright tests."
    );
  });

  test("valid login redirects to dashboard and shows user menu", async ({ page }) => {
    await login(page, E2E_EMAIL, E2E_PASSWORD);

    await page.waitForURL(/\/dashboard(?:\/.*)?$/);
    await expect(page.getByRole("button", { name: "Account", exact: true })).toBeVisible();
  });

  test("logout redirects back to login", async ({ page }) => {
    await login(page, E2E_EMAIL, E2E_PASSWORD);
    await page.waitForURL(/\/dashboard(?:\/.*)?$/);

    await page.getByRole("button", { name: "Account", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Account menu" })).toBeVisible();
    await page.getByRole("button", { name: /^log out$/i }).click();

    await page.waitForURL(/\/login$/);
    await expect(page.locator("#login-email")).toBeVisible();
  });

  test("invalid login shows an error message", async ({ page }) => {
    await login(page, E2E_EMAIL, INVALID_PASSWORD);

    await expect(page).toHaveURL(/\/login$/);
    const alert = page.locator("p[role='alert']");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/invalid|failed|password/i);
  });
});
