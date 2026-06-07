import { resolveVisibleReportColumns } from "../../lib/reports/resolveVisibleReportColumns";
import { getReportConfig } from "../../lib/reportConfig";

describe("report_branch_register config", () => {
  test("getReportConfig returns branch register with expected columns", () => {
    const cfg = getReportConfig("report_branch_register");
    expect(cfg?.label).toMatch(/Branch Register/i);
    expect(cfg?.columns?.map((c) => c.key)).toEqual([
      "slNo",
      "bankLabel",
      "hoZoLabel",
      "rboRoLabel",
      "branchCode",
      "branchName",
      "place",
      "active"
    ]);
  });

  test("hideWhenFilterSet hides bank column when bank filter selected", () => {
    const cfg = getReportConfig("report_branch_register");
    const visible = resolveVisibleReportColumns(cfg.columns, cfg.fields, { bank: "3" });
    expect(visible.map((c) => c.key)).not.toContain("bankLabel");
    expect(visible.map((c) => c.key)).toContain("branchCode");
  });

  test("hideWhenFilterSet hides active column when active filter selected", () => {
    const cfg = getReportConfig("report_branch_register");
    const visible = resolveVisibleReportColumns(cfg.columns, cfg.fields, { active: "Yes" });
    expect(visible.map((c) => c.key)).not.toContain("active");
  });
});
