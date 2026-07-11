// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `reportAnnualInvoicesReceivedLedger`.
 * Run with: npm test
 */

import { getReportConfig } from "../../lib/reportConfig";
import { getReportFilterInitialValues } from "../../lib/reports/reportFilterDefaults";
import { groupStandardLedgerSections } from "../../lib/reports/groupStandardLedgerSections";
import { getReportRunner } from "../../lib/reports/reportRegistry";
import { buildAnnualInvoicesReceivedSummaryAggregatedSql } from "../../lib/reports/report_annual_invoices_received_ledger";
import {
  buildInvoicesReceivedLedgerWhereSql,
  MONTH_LABEL_FORMAT_INVOICES_RECEIVED
} from "../../lib/reports/report_invoices_received_ledger";

describe("report_annual_invoices_received_ledger config", () => {
  test("getReportConfig returns summary grouped annual invoices received ledger report", () => {
    const cfg = getReportConfig("report_annual_invoices_received_ledger");
    expect(cfg?.label).toBe("Annual Invoices Received Ledger");
    expect(cfg?.group).toBe("Annual Accounts Reports");
    expect(cfg?.reportLayout?.title).toBe("ANNUAL INVOICES RECEIVED LEDGER");
    expect(cfg?.fields?.find((f) => f.name === "financialYear")?.required).toBe(true);
    expect(cfg?.fields?.find((f) => f.name === "month")).toBeUndefined();
    expect(cfg?.fields?.find((f) => f.name === "dataType")).toBeUndefined();
    expect(cfg?.reportLayout?.tableFitContent).toBe(true);
    expect(cfg?.reportLayout?.contentAlign).toBe("center");
    expect(cfg?.reportStyle?.totalRow?.labelColumn).toBe("monthLabel");
    expect(cfg?.reportStyle?.sectionTotalRow?.labelColumn).toBe("monthLabel");
    expect(cfg?.columns?.map((c) => c.key)).toEqual([
      "monthLabel",
      "billedAmount",
      "tdsAmount",
      "receivedAmount"
    ]);
    expect(cfg?.columns?.find((c) => c.key === "billedAmount")?.sum).toBe(true);
    expect(cfg?.columns?.find((c) => c.key === "tdsAmount")?.sum).toBe(true);
    expect(cfg?.columns?.find((c) => c.key === "receivedAmount")?.sum).toBe(true);
  });

  test("financial year filter defaults and output format HTML", () => {
    const cfg = getReportConfig("report_annual_invoices_received_ledger");
    const values = getReportFilterInitialValues(cfg);
    expect(values.outputFormat).toBe("HTML");
  });

  test("runner is registered", () => {
    expect(typeof getReportRunner("report_annual_invoices_received_ledger")?.runReport).toBe("function");
  });
});

describe("buildInvoicesReceivedLedgerWhereSql financial year range", () => {
  test("uses explicit date range when provided", () => {
    const { whereSql, values } = buildInvoicesReceivedLedgerWhereSql(
      {},
      { from: "2025-04-01", to: "2026-03-31" }
    );
    expect(whereSql).toContain("DATE(ir.receivedDate) >= ?");
    expect(whereSql).toContain("DATE(ir.receivedDate) <= ?");
    expect(values).toEqual(["2025-04-01", "2026-03-31"]);
  });
});

describe("buildAnnualInvoicesReceivedSummaryAggregatedSql", () => {
  test("aggregates by npa current ac and month with sum of received amount", () => {
    const { sql, values } = buildAnnualInvoicesReceivedSummaryAggregatedSql(
      { financialYear: "1" },
      { from: "2025-04-01", to: "2026-03-31" }
    );
    expect(sql).toContain("GROUP BY npaCurrentAcLabel, monthLabel, monthKey");
    expect(sql).toContain("SUM(receivedAmount) AS receivedAmount");
    expect(sql).toContain("SUM(billedAmount) AS billedAmount");
    expect(sql).toContain("SUM(tdsAmount) AS tdsAmount");
    expect(sql).toContain(`DATE_FORMAT(ir.receivedDate, '${MONTH_LABEL_FORMAT_INVOICES_RECEIVED}')`);
    expect(values).toEqual(["2025-04-01", "2026-03-31"]);
  });
});

describe("groupStandardLedgerSections multi-column sumKeys", () => {
  test("sums billedAmount, tdsAmount, receivedAmount per section and grand total", () => {
    const summaryRows = [
      { npaCurrentAcLabel: "AC1", monthLabel: "April-2025", billedAmount: 100, tdsAmount: 10, receivedAmount: 90 },
      { npaCurrentAcLabel: "AC1", monthLabel: "May-2025", billedAmount: 200, tdsAmount: 20, receivedAmount: 180 },
      { npaCurrentAcLabel: "AC2", monthLabel: "April-2025", billedAmount: 50, tdsAmount: 5, receivedAmount: 45 }
    ];
    const { sections, grandTotal } = groupStandardLedgerSections(summaryRows, {
      groupKey: "npaCurrentAcLabel",
      sumKeys: ["billedAmount", "tdsAmount", "receivedAmount"],
      headerPrefix: "NPA Current AC"
    });
    expect(sections).toHaveLength(2);
    expect(sections[0].headerLabel).toBe("NPA Current AC: AC1");
    expect(sections[0].subtotal).toEqual({ billedAmount: 300, tdsAmount: 30, receivedAmount: 270 });
    expect(sections[1].subtotal).toEqual({ billedAmount: 50, tdsAmount: 5, receivedAmount: 45 });
    expect(grandTotal).toEqual({ billedAmount: 350, tdsAmount: 35, receivedAmount: 315 });
  });
});

