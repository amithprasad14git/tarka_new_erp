// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `resolveVisibleReportColumns`.
 * Run with: npm test
 */

import {
  isReportFilterActive,
  resolveVisibleReportColumns
} from "../../lib/reports/resolveVisibleReportColumns";

const lookupField = { name: "unit", type: "lookup" };
const fields = [lookupField, { name: "branch", type: "lookup" }];

const columns = [
  { key: "slNo", label: "SL. NO." },
  { key: "unitLabel", label: "UNIT", hideWhenFilterSet: "unit" },
  { key: "branchLabel", label: "BRANCH", hideWhenFilterSet: "branch" },
  { key: "borrower", label: "BORROWER" }
];

describe("resolveVisibleReportColumns", () => {
  test("isReportFilterActive treats empty, 0, and '0' as inactive", () => {
    expect(isReportFilterActive("", lookupField)).toBe(false);
    expect(isReportFilterActive(null, lookupField)).toBe(false);
    expect(isReportFilterActive(0, lookupField)).toBe(false);
    expect(isReportFilterActive("0", lookupField)).toBe(false);
  });

  test("isReportFilterActive treats valid lookup id as active", () => {
    expect(isReportFilterActive("12", lookupField)).toBe(true);
    expect(isReportFilterActive(12, lookupField)).toBe(true);
  });

  test("shows all columns when no filters selected", () => {
    const visible = resolveVisibleReportColumns(columns, fields, {});
    expect(visible.map((c) => c.key)).toEqual(["slNo", "unitLabel", "branchLabel", "borrower"]);
  });

  test("hides unitLabel when unit filter is selected", () => {
    const visible = resolveVisibleReportColumns(columns, fields, { unit: "5" });
    expect(visible.map((c) => c.key)).toEqual(["slNo", "branchLabel", "borrower"]);
  });

  test("hides branchLabel when branch filter is selected", () => {
    const visible = resolveVisibleReportColumns(columns, fields, { branch: "99" });
    expect(visible.map((c) => c.key)).toEqual(["slNo", "unitLabel", "borrower"]);
  });

  test("keeps column when filter is 0 or '0'", () => {
    expect(resolveVisibleReportColumns(columns, fields, { unit: 0 }).map((c) => c.key)).toContain(
      "unitLabel"
    );
    expect(resolveVisibleReportColumns(columns, fields, { unit: "0" }).map((c) => c.key)).toContain(
      "unitLabel"
    );
  });

  test("always shows columns without hideWhenFilterSet", () => {
    const visible = resolveVisibleReportColumns(columns, fields, { unit: "1", branch: "2" });
    expect(visible.map((c) => c.key)).toEqual(["slNo", "borrower"]);
  });
});

