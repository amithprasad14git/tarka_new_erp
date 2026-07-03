/**
 * SARFAESI Case Status Update client — particulars preload LoV wiring.
 */

jest.mock("../../config/modules", () => ({
  modules: {
    sarfaesi_case_particulars: { table: "sarfaesi_case_particulars" },
    sarfaesi_case_status_update: {
      table: "sarfaesi_case_status_update",
      fields: [],
      childTables: [
        {
          key: "sarfaesi_case_status_update_details",
          fields: [
            {
              name: "particulars",
              type: "lookup",
              lookup: { module: "sarfaesi_case_particulars", valueField: "id", labelField: "particulars" }
            }
          ]
        }
      ]
    }
  }
}));

jest.mock("../../lib/rbac", () => ({
  hasModulePermission: jest.fn()
}));

const { hasModulePermission } = require("../../lib/rbac");
const { canAccessLovViaReferencingModule } = require("../../lib/lookupLovAccess");

describe("sarfaesiCaseStatusUpdateClient particulars preload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("status update child grid references sarfaesi_case_particulars in real module config", () => {
    const { modules: realModules } = jest.requireActual("../../config/modules");
    const { moduleConfigReferencesLookup } = jest.requireActual("../../lib/lookupLovAccess");
    expect(
      moduleConfigReferencesLookup(realModules.sarfaesi_case_status_update, "sarfaesi_case_particulars")
    ).toBe(true);
  });

  test("users with sarfaesi_case_status_update create can list particulars via lov=1", async () => {
    hasModulePermission.mockResolvedValueOnce(false).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(
      canAccessLovViaReferencingModule({ id: 10, role: 2 }, "sarfaesi_case_particulars")
    ).resolves.toBe(true);

    expect(hasModulePermission).toHaveBeenCalledWith(
      { id: 10, role: 2 },
      "sarfaesi_case_status_update",
      "view"
    );
    expect(hasModulePermission).toHaveBeenCalledWith(
      { id: 10, role: 2 },
      "sarfaesi_case_status_update",
      "create"
    );
  });

  test("users without sarfaesi_case_status_update access cannot list particulars via lov=1", async () => {
    hasModulePermission.mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(false);

    await expect(
      canAccessLovViaReferencingModule({ id: 10, role: 2 }, "sarfaesi_case_particulars")
    ).resolves.toBe(false);
  });
});
