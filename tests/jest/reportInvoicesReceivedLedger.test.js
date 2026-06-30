import { getReportConfig } from "../../lib/reportConfig";
import { getReportFilterInitialValues } from "../../lib/reports/reportFilterDefaults";
import { buildFilterSummaryText } from "../../lib/reports/buildFilterSummary";
import { getReportRunner } from "../../lib/reports/reportRegistry";
import { buildInvoicesReceivedLedgerWhereSql } from "../../lib/reports/report_invoices_received_ledger";

describe("report_invoices_received_ledger config", () => {
  test("getReportConfig returns standard table report", () => {
    const cfg = getReportConfig("report_invoices_received_ledger");
    expect(cfg?.label).toMatch(/Invoices Received Ledger/i);
    expect(cfg?.group).toBe("Accounts Reports");
    expect(cfg?.reportLayout?.title).toBe("INVOICES RECEIVED LEDGER");
    expect(cfg?.reportLayout?.mode).toBeUndefined();
    expect(cfg?.fields?.find((f) => f.name === "month")?.type).toBe("month");
    expect(cfg?.fields?.find((f) => f.name === "dataType")).toBeUndefined();
    expect(cfg?.filterCascade).toEqual([
      { parent: "unit", child: "npaCurrentAc", lovParam: "f_unit" },
      { parent: "bank", child: "ho_zo", lovParam: "f_bank" },
      { parent: "ho_zo", child: "rbo_ro", lovParam: "f_ho_zo" },
      { parent: "rbo_ro", child: "branch", lovParam: "f_rbo_ro" }
    ]);
    expect(cfg?.columns?.map((c) => c.key)).toEqual([
      "slNo",
      "invoiceDate",
      "invoiceNo",
      "receivedDate",
      "refNo",
      "caseNo",
      "borrower",
      "unitLabel",
      "bankLabel",
      "branchLabel",
      "npaCurrentAcLabel",
      "billedAmount",
      "tdsPercentage",
      "tdsAmount",
      "receivedAmount",
      "roundOff"
    ]);
    expect(cfg?.columns?.find((c) => c.key === "billedAmount")?.sum).toBe(true);
    expect(cfg?.columns?.find((c) => c.key === "tdsAmount")?.sum).toBe(true);
    expect(cfg?.columns?.find((c) => c.key === "receivedAmount")?.sum).toBe(true);
    expect(cfg?.reportStyle?.totalRow?.labelColumn).toBe("refNo");
  });

  test("month filter defaults to current month", () => {
    const cfg = getReportConfig("report_invoices_received_ledger");
    const values = getReportFilterInitialValues(cfg);
    expect(values.month).toMatch(/^\d{4}-\d{2}$/);
    expect(values.outputFormat).toBe("HTML");
  });

  test("runner is registered", () => {
    expect(typeof getReportRunner("report_invoices_received_ledger")?.runReport).toBe("function");
  });
});

describe("buildInvoicesReceivedLedgerWhereSql", () => {
  test("always applies receivedDate month bounds", () => {
    const { whereSql, values } = buildInvoicesReceivedLedgerWhereSql({ month: "2026-05" });
    expect(whereSql).toContain("DATE(ir.receivedDate) >= ?");
    expect(whereSql).toContain("DATE(ir.receivedDate) <= ?");
    expect(values).toEqual(["2026-05-01", "2026-05-31"]);
  });

  test("applies optional dimension filters when set in header", () => {
    const { whereSql, values } = buildInvoicesReceivedLedgerWhereSql({
      month: "2026-03",
      unit: "2",
      npaCurrentAc: "5",
      bank: "1",
      ho_zo: "3",
      rbo_ro: "4",
      branch: "6"
    });
    expect(whereSql).toContain("COALESCE(ri.billToUnit, si.billToUnit, vi.billToUnit) = ?");
    expect(whereSql).toContain("COALESCE(ri.npaCurrentAc, si.npaCurrentAc, vi.npaCurrentAc) = ?");
    expect(whereSql).toContain("bank.id = ?");
    expect(whereSql).toContain("hz.id = ?");
    expect(whereSql).toContain("rbo.id = ?");
    expect(whereSql).toContain("nci.branch = ?");
    expect(values).toEqual(["2026-03-01", "2026-03-31", 2, 5, 1, 3, 4, 6]);
  });

  test("does not apply unit filter when unit header is empty", () => {
    const { whereSql, values } = buildInvoicesReceivedLedgerWhereSql({ month: "2026-02" });
    expect(whereSql).not.toContain("COALESCE(ri.billToUnit, si.billToUnit, vi.billToUnit) = ?");
    expect(whereSql).not.toContain("1=0");
    expect(values).toEqual(["2026-02-01", "2026-02-28"]);
  });

  test("applies invoice billToUnit when unit is selected in header", () => {
    const { whereSql, values } = buildInvoicesReceivedLedgerWhereSql({
      month: "2026-02",
      unit: "7"
    });
    expect(whereSql).toContain("COALESCE(ri.billToUnit, si.billToUnit, vi.billToUnit) = ?");
    expect(values).toEqual(["2026-02-01", "2026-02-28", 7]);
  });
});

describe("buildFilterSummaryText month label", () => {
  test("formats month filter as MM/YYYY", () => {
    const cfg = getReportConfig("report_invoices_received_ledger");
    const summary = buildFilterSummaryText(cfg, { month: "2026-05" });
    expect(summary).toContain("Month: 05/2026");
  });
});
