import { getReportConfig } from "../../lib/reportConfig";
import { getReportFilterInitialValues } from "../../lib/reports/reportFilterDefaults";
import { buildFilterSummaryText } from "../../lib/reports/buildFilterSummary";
import { getReportRunner } from "../../lib/reports/reportRegistry";
import {
  AUDIT_LOG_ACTION_OPTIONS,
  buildAuditLogModuleFilterOptions
} from "../../lib/reports/auditLogReportOptions";
import { buildAuditLogReportWhereSql } from "../../lib/reports/report_audit_log_report";

describe("report_audit_log_report config", () => {
  test("getReportConfig returns standard table report", () => {
    const cfg = getReportConfig("report_audit_log_report");
    expect(cfg?.label).toMatch(/Audit Log Report/i);
    expect(cfg?.group).toBe("General Reports");
    expect(cfg?.reportLayout?.title).toBe("AUDIT LOG REPORT");
    expect(cfg?.reportLayout?.mode).toBeUndefined();
    expect(cfg?.fields?.find((f) => f.name === "fromDate")?.required).toBe(true);
    expect(cfg?.fields?.find((f) => f.name === "toDate")?.required).toBe(true);
    expect(cfg?.columns?.map((c) => c.key)).toEqual([
      "slNo",
      "createdDate",
      "userLabel",
      "moduleLabel",
      "action",
      "recordLabel",
      "oldData",
      "newData"
    ]);
    expect(cfg?.columns?.find((c) => c.key === "createdDate")?.label).toBe("CREATED DATE");
  });

  test("date filters default to current month", () => {
    const cfg = getReportConfig("report_audit_log_report");
    const values = getReportFilterInitialValues(cfg);
    expect(values.fromDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(values.toDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(values.outputFormat).toBe("HTML");
  });

  test("runner is registered", () => {
    expect(typeof getReportRunner("report_audit_log_report")?.runReport).toBe("function");
  });
});

describe("auditLogReportOptions", () => {
  test("action options include create, update, delete", () => {
    expect(AUDIT_LOG_ACTION_OPTIONS.map((o) => o.value)).toEqual(["create", "update", "delete"]);
  });

  test("module options exclude audit_logs and are sorted by label", () => {
    const opts = buildAuditLogModuleFilterOptions();
    expect(opts.length).toBeGreaterThan(0);
    expect(opts.some((o) => o.value === "audit_logs")).toBe(false);
    const labels = opts.map((o) => o.label);
    expect([...labels].sort((a, b) => a.localeCompare(b))).toEqual(labels);
  });
});

describe("buildAuditLogReportWhereSql", () => {
  test("always applies date range", () => {
    const { whereSql, values } = buildAuditLogReportWhereSql({
      fromDate: "2026-01-01",
      toDate: "2026-01-31"
    });
    expect(whereSql).toContain("DATE(al.createdDate) >= ?");
    expect(whereSql).toContain("DATE(al.createdDate) <= ?");
    expect(values).toEqual(["2026-01-01", "2026-01-31"]);
  });

  test("applies optional module, action, and user filters", () => {
    const { whereSql, values } = buildAuditLogReportWhereSql({
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
      module: "employee_master",
      action: "Update",
      user: "42"
    });
    expect(whereSql).toContain("al.module = ?");
    expect(whereSql).toContain("LOWER(TRIM(al.action)) = ?");
    expect(whereSql).toContain("al.user_id = ?");
    expect(values).toEqual(["2026-01-01", "2026-01-31", "employee_master", "update", 42]);
  });
});

describe("buildFilterSummaryText select labels", () => {
  test("resolves select option label for module and action", () => {
    const cfg = getReportConfig("report_audit_log_report");
    const summary = buildFilterSummaryText(cfg, {
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
      module: "employee_master",
      action: "create"
    });
    expect(summary).toContain("From Date: 01-01-2026");
    expect(summary).toContain("To Date: 31-01-2026");
    expect(summary).toContain("Module: Employee Master");
    expect(summary).toContain("Action: Create");
  });
});
