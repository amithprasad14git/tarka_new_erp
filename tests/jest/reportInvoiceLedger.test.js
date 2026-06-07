import { getReportConfig } from "../../lib/reportConfig";
import { getReportFilterInitialValues } from "../../lib/reports/reportFilterDefaults";
import { buildFilterSummaryText } from "../../lib/reports/buildFilterSummary";
import { getReportRunner } from "../../lib/reports/reportRegistry";
import {
  INVOICE_LEDGER_DATA_TYPE_ACTIVE,
  INVOICE_LEDGER_DATA_TYPE_CANCELLED,
  INVOICE_LEDGER_DATA_TYPE_PENDING,
  buildInvoiceLedgerDataTypeWhereSql,
  buildInvoiceLedgerDimensionWhereSql,
  normalizeInvoiceLedgerDataType
} from "../../lib/reports/report_invoice_ledger";

describe("report_invoice_ledger config", () => {
  test("getReportConfig returns standard table report", () => {
    const cfg = getReportConfig("report_invoice_ledger");
    expect(cfg?.label).toMatch(/Invoice Ledger/i);
    expect(cfg?.group).toBe("Accounts Reports");
    expect(cfg?.reportLayout?.title).toBe("INVOICE LEDGER");
    expect(cfg?.reportLayout?.mode).toBeUndefined();
    expect(cfg?.fields?.find((f) => f.name === "month")?.type).toBe("month");
    expect(cfg?.fields?.find((f) => f.name === "dataType")?.default).toBe("Show Active Invoices");
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
      "caseNo",
      "borrower",
      "unitLabel",
      "bankLabel",
      "branchLabel",
      "npaCurrentAcLabel",
      "finalInvoice",
      "grandTotal"
    ]);
    expect(cfg?.columns?.find((c) => c.key === "grandTotal")?.sum).toBe(true);
    expect(cfg?.reportStyle?.totalRow?.labelColumn).toBe("invoiceNo");
  });

  test("month filter defaults to current month", () => {
    const cfg = getReportConfig("report_invoice_ledger");
    const values = getReportFilterInitialValues(cfg);
    expect(values.month).toMatch(/^\d{4}-\d{2}$/);
    expect(values.dataType).toBe("Show Active Invoices");
    expect(values.outputFormat).toBe("HTML");
  });

  test("runner is registered", () => {
    expect(typeof getReportRunner("report_invoice_ledger")?.runReport).toBe("function");
  });
});

describe("normalizeInvoiceLedgerDataType", () => {
  test("defaults to active", () => {
    expect(normalizeInvoiceLedgerDataType(undefined)).toBe(INVOICE_LEDGER_DATA_TYPE_ACTIVE);
    expect(normalizeInvoiceLedgerDataType("")).toBe(INVOICE_LEDGER_DATA_TYPE_ACTIVE);
    expect(normalizeInvoiceLedgerDataType("invalid")).toBe(INVOICE_LEDGER_DATA_TYPE_ACTIVE);
  });

  test("accepts pending and cancelled", () => {
    expect(normalizeInvoiceLedgerDataType(INVOICE_LEDGER_DATA_TYPE_PENDING)).toBe(
      INVOICE_LEDGER_DATA_TYPE_PENDING
    );
    expect(normalizeInvoiceLedgerDataType(INVOICE_LEDGER_DATA_TYPE_CANCELLED)).toBe(
      INVOICE_LEDGER_DATA_TYPE_CANCELLED
    );
  });
});

describe("buildInvoiceLedgerDataTypeWhereSql", () => {
  test("active filters non-cancelled invoices", () => {
    const { parts, values } = buildInvoiceLedgerDataTypeWhereSql(
      INVOICE_LEDGER_DATA_TYPE_ACTIVE,
      "inv",
      "recoveryInvoice"
    );
    expect(parts).toEqual(["inv.cancelledInvoice = ?"]);
    expect(values).toEqual(["No"]);
  });

  test("cancelled filters cancelled invoices", () => {
    const { parts, values } = buildInvoiceLedgerDataTypeWhereSql(
      INVOICE_LEDGER_DATA_TYPE_CANCELLED,
      "inv",
      "recoveryInvoice"
    );
    expect(parts).toEqual(["inv.cancelledInvoice = ?"]);
    expect(values).toEqual(["Yes"]);
  });

  test("pending filters non-cancelled and not received", () => {
    const { parts, values } = buildInvoiceLedgerDataTypeWhereSql(
      INVOICE_LEDGER_DATA_TYPE_PENDING,
      "inv",
      "sarfaesiInvoice"
    );
    expect(parts[0]).toBe("inv.cancelledInvoice = ?");
    expect(parts[1]).toContain("NOT EXISTS");
    expect(parts[1]).toContain("sarfaesiInvoice");
    expect(values).toEqual(["No"]);
  });
});

describe("buildInvoiceLedgerDimensionWhereSql", () => {
  test("always applies month date bounds", () => {
    const { parts, values } = buildInvoiceLedgerDimensionWhereSql({ month: "2026-03" });
    expect(parts).toContain("DATE(inv.date) >= ?");
    expect(parts).toContain("DATE(inv.date) <= ?");
    expect(values).toEqual(["2026-03-01", "2026-03-31"]);
  });

  test("applies optional dimension filters for admin user", () => {
    const { parts, values } = buildInvoiceLedgerDimensionWhereSql(
      {
        month: "2026-01",
        unit: "2",
        npaCurrentAc: "5",
        bank: "1",
        ho_zo: "3",
        rbo_ro: "4",
        branch: "6"
      },
      { role: 1 }
    );
    expect(parts).toContain("nci.unit = ?");
    expect(parts).toContain("inv.npaCurrentAc = ?");
    expect(parts).toContain("bank.id = ?");
    expect(parts).toContain("hz.id = ?");
    expect(parts).toContain("rbo.id = ?");
    expect(parts).toContain("nci.branch = ?");
    expect(values).toEqual(["2026-01-01", "2026-01-31", 2, 5, 1, 3, 4, 6]);
  });

  test("role 2 enforces session unit via case join", () => {
    const { parts, values } = buildInvoiceLedgerDimensionWhereSql(
      { month: "2026-02" },
      { role: 2, unit: 7 }
    );
    expect(parts).toContain("nci.unit = ?");
    expect(values).toEqual(["2026-02-01", "2026-02-28", 7]);
  });

  test("role 2 with no session unit returns no rows", () => {
    const { parts, values } = buildInvoiceLedgerDimensionWhereSql(
      { month: "2026-02" },
      { role: 2 }
    );
    expect(parts).toContain("1=0");
    expect(values).toEqual(["2026-02-01", "2026-02-28"]);
  });
});

describe("buildFilterSummaryText month and data type labels", () => {
  test("formats month and data type filters", () => {
    const cfg = getReportConfig("report_invoice_ledger");
    const summary = buildFilterSummaryText(cfg, {
      month: "2026-04",
      dataType: "Show Pending Invoices"
    });
    expect(summary).toContain("Month: 04/2026");
    expect(summary).toContain("Data Type: Show Pending Invoices");
  });
});
