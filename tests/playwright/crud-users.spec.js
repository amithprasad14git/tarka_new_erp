const { test, expect } = require("@playwright/test");

const E2E_EMAIL = process.env.E2E_EMAIL || "amith@mail";
const E2E_PASSWORD = process.env.E2E_PASSWORD || "pass";
const USERS_MODULE_URL = "/dashboard/users";

async function login(page) {
  await page.goto("/login");
  await expect(page.locator("#login-email")).toBeVisible();
  await page.fill("#login-email", E2E_EMAIL);
  await page.fill("#login-password", E2E_PASSWORD);
  await page.getByRole("button", { name: /^login$/i }).click();
  await page.waitForURL(/\/dashboard(?:\/.*)?$/);
}

async function openUsersModule(page) {
  await page.goto(USERS_MODULE_URL);
  await expect(page.getByRole("heading", { name: "Users", exact: true })).toBeVisible();
  await expect(page.locator(".loading-overlay")).toHaveCount(0);
}

async function switchToViewMode(page) {
  const table = page.locator("table.data-table");
  if (await table.isVisible()) return;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actionsSummary = page.locator("summary.master-actions-summary");
    if (await actionsSummary.isVisible()) {
      await actionsSummary.click();
      const viewMenuItem = page.getByRole("menuitem", { name: "View", exact: true });
      if (await viewMenuItem.isVisible()) {
        await viewMenuItem.click();
      }
    }

    const viewButton = page.getByRole("button", { name: "View", exact: true });
    if (await viewButton.isVisible()) {
      await viewButton.click();
    }

    try {
      await expect(table).toBeVisible({ timeout: 8000 });
      return;
    } catch {
      // Retry to handle occasional delayed render or dropped click.
    }
  }

  await expect(table).toBeVisible({ timeout: 15000 });
}

async function filterByEmail(page, email) {
  const emailFilter = page.getByLabel("Filter Email", { exact: true });
  await emailFilter.fill(email);
  await emailFilter.press("Enter");
}

function rowByEmail(page, email) {
  return page.locator("table.data-table tbody tr", { hasText: email });
}

async function fillAndEnsureValue(page, selector, value) {
  const input = page.locator(selector);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await input.fill(value);
    try {
      await expect(input).toHaveValue(value, { timeout: 2000 });
      return;
    } catch {
      // Field may have been reset by a late re-render; retry.
    }
  }
  await expect(input).toHaveValue(value);
}

async function expectUserRowPresentByEmail(page, email) {
  await filterByEmail(page, email);
  const row = rowByEmail(page, email);
  if ((await row.count()) > 0) return row;

  // Fallback: reload the module once in case list refresh lagged.
  await openUsersModule(page);
  await switchToViewMode(page);
  await filterByEmail(page, email);
  await expect(rowByEmail(page, email)).toHaveCount(1, { timeout: 20000 });
  return rowByEmail(page, email);
}

async function deleteUserIfPresent(page, email) {
  await openUsersModule(page);
  try {
    await switchToViewMode(page);
  } catch {
    return;
  }
  await filterByEmail(page, email);

  const row = rowByEmail(page, email);
  if ((await row.count()) === 0) return;

  await row.locator("input[type='checkbox']").first().check();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete record", exact: true }).click();
  await expect(row).toHaveCount(0, { timeout: 15000 });
}

test.describe("Users module CRUD", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Set E2E_EMAIL and E2E_PASSWORD to run Users CRUD E2E test.");
    await login(page);
  });

  test("create, verify, edit, verify, delete, verify", async ({ page }) => {
    test.setTimeout(90000);
    const stamp = `${Date.now()}`;
    const createdName = `PW User ${stamp}`;
    const updatedName = `PW User Updated ${stamp}`;
    const createdEmail = `pw.user.${stamp}@example.com`;
    const createdPassword = `Pw#${stamp.slice(-6)}Ab`;

    await openUsersModule(page);

    try {
      await expect(page.locator(".loading-overlay")).toHaveCount(0);
      const unitSelect = page.getByRole("combobox", { name: "Unit", exact: true });
      await expect(unitSelect).toBeVisible();
      await unitSelect.selectOption({ index: 1 });

      const activeSelect = page.getByRole("combobox", { name: "Active", exact: true });
      await activeSelect.selectOption("Yes");

      // Important: some async lookup/state refreshes can reset text inputs.
      // Fill text fields at the end and save immediately.
      await fillAndEnsureValue(page, "#field-fullName", createdName);
      await fillAndEnsureValue(page, "#field-email", createdEmail);
      await fillAndEnsureValue(page, "#field-password", createdPassword);
      await fillAndEnsureValue(page, "#field-role", "2");

      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.locator(".loading-overlay")).toHaveCount(0, { timeout: 20000 });

      await switchToViewMode(page);
      const createdRow = await expectUserRowPresentByEmail(page, createdEmail);
      await expect(createdRow).toContainText(createdName);

      await createdRow.locator("input[type='checkbox']").first().check();
      await page.getByRole("button", { name: "Edit record", exact: true }).click();
      await expect(page.locator("#field-fullName")).toBeVisible();

      await fillAndEnsureValue(page, "#field-fullName", updatedName);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.locator(".loading-overlay")).toHaveCount(0, { timeout: 20000 });

      await switchToViewMode(page);
      const updatedRow = await expectUserRowPresentByEmail(page, createdEmail);
      await expect(updatedRow).toContainText(updatedName);

      await updatedRow.locator("input[type='checkbox']").first().check();
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Delete record", exact: true }).click();
      await expect(updatedRow).toHaveCount(0, { timeout: 15000 });
    } finally {
      await deleteUserIfPresent(page, createdEmail);
    }
  });
});
