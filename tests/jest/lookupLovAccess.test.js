// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `lookupLovAccess`.
 * Run with: npm test
 */

// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Comprehensive tests for lib/lookupLovAccess.js
 */

// Replace real database, auth, and Next.js pieces with fakes so tests run offline.
jest.mock("../../config/modules", () => ({
  modules: {
    lookup_value_master: { table: "lookup_value_master" },
    parent_with_lookup: {
      table: "parent_with_lookup",
      fields: [
        {
          name: "status",
          type: "lookup",
          lookup: { module: "lookup_value_master", valueField: "id" }
        }
      ]
    },
    parent_child_lookup: {
      table: "parent_child_lookup",
      fields: [{ name: "name", type: "text" }],
      childTables: [
        {
          key: "lines",
          table: "parent_child_lookup_lines",
          fields: [
            {
              name: "lineLookup",
              type: "lookup",
              lookup: { module: "lookup_value_master", valueField: "id" }
            }
          ]
        }
      ]
    },
    unrelated_module: {
      table: "unrelated_module",
      fields: [{ name: "title", type: "text" }]
    }
  }
}));

jest.mock("../../lib/rbac", () => ({
  hasModulePermission: jest.fn()
}));

const { hasModulePermission } = require("../../lib/rbac");
const { moduleConfigReferencesLookup, canAccessLovViaReferencingModule } = require("../../lib/lookupLovAccess");

// Automated checks for: lookupLovAccess.moduleConfigReferencesLookup.
describe("lookupLovAccess.moduleConfigReferencesLookup", () => {
  test("returns true when parent fields reference lookup module", () => {
    const moduleConfig = {
      fields: [{ name: "x", type: "lookup", lookup: { module: "lookup_value_master" } }]
    };
    expect(moduleConfigReferencesLookup(moduleConfig, "lookup_value_master")).toBe(true);
  });

  test("returns true when child table fields reference lookup module", () => {
    const moduleConfig = {
      fields: [],
      childTables: [{ fields: [{ name: "x", type: "lookup", lookup: { module: "lookup_value_master" } }] }]
    };
    expect(moduleConfigReferencesLookup(moduleConfig, "lookup_value_master")).toBe(true);
  });

  test("invalid lookup rejection: returns false for missing/invalid config", () => {
    expect(moduleConfigReferencesLookup(null, "lookup_value_master")).toBe(false);
    expect(moduleConfigReferencesLookup({ fields: [{ name: "x", type: "text" }] }, "lookup_value_master")).toBe(false);
  });
});

// Automated checks for: lookupLovAccess.canAccessLovViaReferencingModule.
describe("lookupLovAccess.canAccessLovViaReferencingModule", () => {
  // Reset mocks and default stubs before each example runs.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("authorized LOV access via referencing parent module (view/create/edit any true)", async () => {
    // First parent_with_lookup: view false, create true, edit false => allowed
    hasModulePermission
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await expect(
      canAccessLovViaReferencingModule({ id: 10, role: 2 }, "lookup_value_master")
    ).resolves.toBe(true);
  });

  test("unauthorized LOV access when no referencing module permission", async () => {
    // parent_with_lookup + parent_child_lookup each ask for view/create/edit (6 calls total)
    hasModulePermission
      .mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(false);

    await expect(
      canAccessLovViaReferencingModule({ id: 10, role: 2 }, "lookup_value_master")
    ).resolves.toBe(false);
  });

  test("admin bypass allows LOV access", async () => {
    await expect(
      canAccessLovViaReferencingModule({ id: 1, role: 1 }, "lookup_value_master")
    ).resolves.toBe(true);
    expect(hasModulePermission).not.toHaveBeenCalled();
  });

  test("invalid lookup rejection: unknown lookup module key returns false", async () => {
    await expect(
      canAccessLovViaReferencingModule({ id: 10, role: 2 }, "unknown_lookup_module")
    ).resolves.toBe(false);
  });

  test("inactive lookup rejection equivalent: null user is denied", async () => {
    await expect(canAccessLovViaReferencingModule(null, "lookup_value_master")).resolves.toBe(false);
    expect(hasModulePermission).not.toHaveBeenCalled();
  });

  test("row-scope restricted lookup equivalent: module permission false means LOV denied", async () => {
    hasModulePermission
      .mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(false);

    await expect(
      canAccessLovViaReferencingModule({ id: 99, role: 2, unit: 3 }, "lookup_value_master")
    ).resolves.toBe(false);
  });

  test("database failure handling: permission check rejection is propagated", async () => {
    hasModulePermission.mockRejectedValueOnce(new Error("permission db failed"));
    await expect(
      canAccessLovViaReferencingModule({ id: 10, role: 2 }, "lookup_value_master")
    ).rejects.toThrow("permission db failed");
  });
});



