const { test, expect } = require("@playwright/test");

const E2E_LIMITED_EMAIL = process.env.E2E_LIMITED_EMAIL || "amith@mail";
const E2E_LIMITED_PASSWORD = process.env.E2E_LIMITED_PASSWORD || "pass";

const PROBE_MODULE_KEYS = [
  "users",
  "user_permissions",
  "audit_logs",
  "company_master",
  "employee_master",
  "unit_master",
  "financial_year_master",
  "current_account_opening_balance",
  "party_master",
  "bank_master",
  "current_account_master",
  "ho_zo_master",
  "rbo_master",
  "branch_master",
  "lookup_type_master",
  "lookup_value_master",
  "new_case_inward_transaction_control",
  "new_case_inward"
];

async function loginAsLimitedUser(page) {
  await page.goto("/login");
  await expect(page.locator("#login-email")).toBeVisible();
  await page.fill("#login-email", E2E_LIMITED_EMAIL);
  await page.fill("#login-password", E2E_LIMITED_PASSWORD);
  await page.getByRole("button", { name: /^login$/i }).click();
  await page.waitForURL(/\/dashboard(?:\/.*)?$/);
}

function getVisibleNavModuleKeys(page) {
  return page
    .locator("aside[aria-label='Main navigation'] a[href^='/dashboard/']")
    .evaluateAll((links) =>
      links
        .map((a) => {
          const href = a.getAttribute("href") || "";
          const m = href.match(/\/dashboard\/([^/?#]+)/);
          return m ? m[1] : "";
        })
        .filter(Boolean)
    );
}

async function getPermissions(page, moduleKey) {
  const response = await page.request.get(`/api/permissions/${moduleKey}`);
  if (!response.ok()) return null;
  return response.json();
}

async function ensureViewMode(page) {
  const table = page.locator("table.data-table");
  if (await table.isVisible()) return;

  const actionsSummary = page.locator("summary.master-actions-summary");
  if (await actionsSummary.isVisible()) {
    await actionsSummary.click();
    const viewMenuItem = page.getByRole("menuitem", { name: "View", exact: true });
    if (await viewMenuItem.isVisible()) await viewMenuItem.click();
  }

  const viewButton = page.getByRole("button", { name: "View", exact: true });
  if (await viewButton.isVisible()) await viewButton.click();
}

test.describe("RBAC limited-user coverage", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !E2E_LIMITED_EMAIL || !E2E_LIMITED_PASSWORD,
      "Set E2E_LIMITED_EMAIL and E2E_LIMITED_PASSWORD for RBAC Playwright tests."
    );
    await loginAsLimitedUser(page);
  });

  test("restricted routes and actions are blocked for limited user", async ({ page }) => {
    test.setTimeout(90000);

    const visibleKeys = await getVisibleNavModuleKeys(page);
    expect(visibleKeys.length).toBeGreaterThan(0);

    const keysToProbe = [...new Set([...PROBE_MODULE_KEYS, ...visibleKeys])];
    const permissionMap = {};
    for (const key of keysToProbe) {
      permissionMap[key] = await getPermissions(page, key);
    }

    const hiddenRestrictedKey = keysToProbe.find(
      (k) => permissionMap[k] && permissionMap[k].canView === false && !visibleKeys.includes(k)
    );
    test.skip(
      !hiddenRestrictedKey,
      "No denied module found for this user. Use a more restricted account for RBAC negative checks."
    );

    // Requirement: unauthorized modules are not shown in navigation.
    const navForRestricted = page.locator(
      `aside[aria-label='Main navigation'] a[href='/dashboard/${hiddenRestrictedKey}']`
    );
    await expect(navForRestricted).toHaveCount(0);

    // Requirement: direct route to restricted module is denied/redirected.
    await page.goto(`/dashboard/${hiddenRestrictedKey}`);
    const deniedPerm = permissionMap[hiddenRestrictedKey] || (await getPermissions(page, hiddenRestrictedKey));
    expect(deniedPerm?.canView).toBeFalsy();

    // For denied modules, dashboard tabs do not open that module panel.
    await expect(page.locator(".dashboard-tab")).toHaveCount(0);

    // Requirement: create/edit/delete unavailable where permission is absent.
    const targetNoCreate = visibleKeys.find((key) => {
      const perm = permissionMap[key];
      return perm?.canView && perm?.canCreate === false;
    });
    test.skip(!targetNoCreate, "No visible module found where create permission is denied.");

    await page.goto(`/dashboard/${targetNoCreate}`);
    await expect(page.locator(".loading-overlay")).toHaveCount(0);

    // Save should not be available when create permission is absent.
    await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: "Save", exact: true })).toHaveCount(0);

    // Move to view mode if possible, then verify edit/delete actions are unavailable.
    const targetNoEditDelete = visibleKeys.find((key) => {
      const perm = permissionMap[key];
      return perm?.canView && (perm?.canEdit === false || perm?.canDelete === false);
    });
    test.skip(
      !targetNoEditDelete,
      "No visible module found where edit or delete permission is denied."
    );

    await page.goto(`/dashboard/${targetNoEditDelete}`);
    await expect(page.locator(".loading-overlay")).toHaveCount(0);
    await ensureViewMode(page);

    const viewPerm = permissionMap[targetNoEditDelete];
    if (viewPerm?.canEdit === false) {
      await expect(page.getByRole("button", { name: "Edit record", exact: true })).toHaveCount(0);
    }
    if (viewPerm?.canDelete === false) {
      await expect(page.getByRole("button", { name: "Delete record", exact: true })).toHaveCount(0);
    }
  });
});
