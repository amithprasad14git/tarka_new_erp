import { getReportConfig } from "../../lib/reportConfig";
import { getReportFilterInitialValues } from "../../lib/reports/reportFilterDefaults";
import { groupStandardLedgerSections } from "../../lib/reports/groupStandardLedgerSections";
import { getReportRunner } from "../../lib/reports/reportRegistry";
import { buildAnnualInvoiceSummaryAggregatedSql } from "../../lib/reports/report_annual_invoice_ledger";
import {
  INVOICE_LEDGER_DATA_TYPE_ACTIVE,
  buildInvoiceLedgerDimensionWhereSql,
  buildInvoiceSubquery,
  MONTH_LABEL_FORMAT_INVOICE_LEDGER
} from "../../lib/reports/report_invoice_ledger";

describe("report_annual_invoice_ledger config", () => {
  test("getReportConfig returns summary grouped annual invoice ledger report", () => {
    const cfg = getReportConfig("report_annual_invoice_ledger");
    expect(cfg?.label).toBe("Annual Invoice Ledger");
    expect(cfg?.group).toBe("Annual Accounts Reports");
    expect(cfg?.reportLayout?.title).toBe("ANNUAL INVOICE LEDGER");
    expect(cfg?.fields?.find((f) => f.name === "financialYear")?.required).toBe(true);
    expect(cfg?.fields?.find((f) => f.name === "month")).toBeUndefined();
    expect(cfg?.fields?.find((f) => f.name === "dataType")?.default).toBe("Show Active Invoices");
    expect(cfg?.reportLayout?.tableFitContent).toBe(true);
    expect(cfg?.reportLayout?.contentAlign).toBe("center");
    expect(cfg?.reportStyle?.totalRow?.labelColumn).toBe("monthLabel");
    expect(cfg?.reportStyle?.sectionTotalRow?.labelColumn).toBe("monthLabel");
    expect(cfg?.columns?.map((c) => c.key)).toEqual(["monthLabel", "amount"]);
    expect(cfg?.columns?.find((c) => c.key === "amount")?.sum).toBe(true);
  });

  test("dataType defaults to Show Active Invoices", () => {
    const cfg = getReportConfig("report_annual_invoice_ledger");
    const values = getReportFilterInitialValues(cfg);
    expect(values.dataType).toBe("Show Active Invoices");
    expect(values.outputFormat).toBe("HTML");
  });

  test("runner is registered", () => {
    expect(typeof getReportRunner("report_annual_invoice_ledger")?.runReport).toBe("function");
  });
});

describe("buildInvoiceLedgerDimensionWhereSql financial year range", () => {
  test("uses explicit date range when provided", () => {
    const { parts, values } = buildInvoiceLedgerDimensionWhereSql(
      {},
      "inv",
      { from: "2025-04-01", to: "2026-03-31" }
    );
    expect(parts).toContain("DATE(inv.date) >= ?");
    expect(parts).toContain("DATE(inv.date) <= ?");
    expect(values).toEqual(["2025-04-01", "2026-03-31"]);
    expect(parts).not.toContain("month");
  });
});

describe("buildInvoiceSubquery summaryOnly", () => {
  test("selects npa current ac, month, and grand total only", () => {
    const { sql } = buildInvoiceSubquery("recovery_invoice", "recoveryInvoice", {
      dataType: INVOICE_LEDGER_DATA_TYPE_ACTIVE
    }, {
      dateRange: { from: "2025-04-01", to: "2026-03-31" },
      summaryOnly: true
    });
    expect(sql).toContain("cam.branch AS npaCurrentAcLabel");
    expect(sql).toContain(`DATE_FORMAT(inv.date, '${MONTH_LABEL_FORMAT_INVOICE_LEDGER}') AS monthLabel`);
    expect(sql).toContain("DATE_FORMAT(inv.date, '%Y-%m') AS monthKey");
    expect(sql).toContain("inv.grandTotal AS grandTotal");
    expect(sql).not.toContain("invoiceNo");
    expect(sql).not.toContain("borrower");
  });
});

describe("buildAnnualInvoiceSummaryAggregatedSql", () => {
  test("aggregates union by npa current ac and month", () => {
    const { sql, values } = buildAnnualInvoiceSummaryAggregatedSql(
      { dataType: INVOICE_LEDGER_DATA_TYPE_ACTIVE },
      { from: "2025-04-01", to: "2026-03-31" }
    );
    expect(sql).toContain("GROUP BY npaCurrentAcLabel, monthLabel, monthKey");
    expect(sql).toContain("SUM(grandTotal) AS amount");
    expect(sql).toContain("ORDER BY npaCurrentAcLabel, monthKey");
    expect(values).toEqual(expect.arrayContaining(["2025-04-01", "2026-03-31"]));
  });
});

describe("groupStandardLedgerSections npa current ac grouping", () => {
  test("groups month summary rows by npa current ac with amount subtotals", () => {
    const summaryRows = [
      { npaCurrentAcLabel: "SBI Main", monthLabel: "April-2025", amount: 100 },
      { npaCurrentAcLabel: "SBI Main", monthLabel: "May-2025", amount: 50 },
      { npaCurrentAcLabel: "HDFC Branch", monthLabel: "April-2025", amount: 200 }
    ];
    const { sections, grandTotal } = groupStandardLedgerSections(summaryRows, {
      groupKey: "npaCurrentAcLabel",
      sumKey: "amount",
      headerPrefix: "NPA Current AC"
    });
    expect(sections).toHaveLength(2);
    expect(sections[0].headerLabel).toBe("NPA Current AC: SBI Main");
    expect(sections[0].rows).toHaveLength(2);
    expect(sections[0].subtotal.amount).toBe(150);
    expect(sections[1].headerLabel).toBe("NPA Current AC: HDFC Branch");
    expect(sections[1].subtotal.amount).toBe(200);
    expect(grandTotal.amount).toBe(350);
  });
});
