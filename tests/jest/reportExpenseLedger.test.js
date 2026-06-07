import { getReportConfig } from "../../lib/reportConfig";
import { getReportFilterInitialValues } from "../../lib/reports/reportFilterDefaults";
import { getReportRunner } from "../../lib/reports/reportRegistry";
import { resolveVisibleReportColumns } from "../../lib/reports/resolveVisibleReportColumns";
import { groupStandardLedgerSections } from "../../lib/reports/groupStandardLedgerSections";
import {
  buildExpenseLedgerWhereSql,
  EXPENSE_LEDGER_DATA_TYPE_GENERAL,
  EXPENSE_LEDGER_DATA_TYPE_PAYMENT_MODE,
  EXPENSE_LEDGER_DATA_TYPE_EXPENSE_CATEGORY
} from "../../lib/reports/report_expense_ledger";

describe("report_expense_ledger config", () => {
  test("getReportConfig returns standard table report with dataType filter", () => {
    const cfg = getReportConfig("report_expense_ledger");
    expect(cfg?.label).toMatch(/Expense Ledger/i);
    expect(cfg?.group).toBe("Accounts Reports");
    expect(cfg?.reportLayout?.title).toBe("EXPENSE LEDGER");
    expect(cfg?.fields?.find((f) => f.name === "dataType")?.required).toBe(true);
    expect(cfg?.fields?.find((f) => f.name === "dataType")?.default).toBe("General");
    expect(cfg?.reportStyle?.sectionTotalRow?.label).toBe("Subtotal");
    expect(cfg?.columns?.find((c) => c.key === "paymentMode")?.hideWhenDataType).toBe(
      "Payment Mode Wise"
    );
    expect(cfg?.columns?.find((c) => c.key === "expenseCategoryLabel")?.hideWhenDataType).toBe(
      "Expense Category Wise"
    );
  });

  test("month and dataType defaults", () => {
    const cfg = getReportConfig("report_expense_ledger");
    const values = getReportFilterInitialValues(cfg);
    expect(values.month).toMatch(/^\d{4}-\d{2}$/);
    expect(values.dataType).toBe("General");
    expect(values.outputFormat).toBe("HTML");
  });

  test("runner is registered", () => {
    expect(typeof getReportRunner("report_expense_ledger")?.runReport).toBe("function");
  });
});

describe("resolveVisibleReportColumns hideWhenDataType", () => {
  test("hides paymentMode column for Payment Mode Wise", () => {
    const cfg = getReportConfig("report_expense_ledger");
    const visible = resolveVisibleReportColumns(cfg.columns, cfg.fields, {
      dataType: "Payment Mode Wise"
    });
    expect(visible.some((c) => c.key === "paymentMode")).toBe(false);
    expect(visible.some((c) => c.key === "expenseCategoryLabel")).toBe(true);
  });

  test("hides expenseCategoryLabel for Expense Category Wise", () => {
    const cfg = getReportConfig("report_expense_ledger");
    const visible = resolveVisibleReportColumns(cfg.columns, cfg.fields, {
      dataType: "Expense Category Wise"
    });
    expect(visible.some((c) => c.key === "expenseCategoryLabel")).toBe(false);
    expect(visible.some((c) => c.key === "paymentMode")).toBe(true);
  });
});

describe("buildExpenseLedgerWhereSql", () => {
  test("applies month bounds", () => {
    const { whereSql, values } = buildExpenseLedgerWhereSql({ month: "2026-03" });
    expect(whereSql).toContain("DATE(aev.date) >= ?");
    expect(whereSql).toContain("DATE(aev.date) <= ?");
    expect(values).toEqual(["2026-03-01", "2026-03-31"]);
  });

  test("applies optional filters for admin", () => {
    const { whereSql, values } = buildExpenseLedgerWhereSql(
      {
        month: "2026-01",
        unit: "2",
        npaCurrentAc: "5",
        paymentMode: "Cash",
        paidTo: "10",
        expenseCategory: "3"
      },
      { role: 1 }
    );
    expect(whereSql).toContain("aev.unit = ?");
    expect(whereSql).toContain("aev.npaCurrentAc = ?");
    expect(whereSql).toContain("aev.paymentMode = ?");
    expect(whereSql).toContain("aev.paidTo = ?");
    expect(whereSql).toContain("aev.expenseCategory = ?");
    expect(values).toEqual(["2026-01-01", "2026-01-31", 2, 5, "Cash", 10, 3]);
  });

  test("role 2 enforces session unit", () => {
    const { whereSql, values } = buildExpenseLedgerWhereSql(
      { month: "2026-01", unit: "99" },
      { role: 2, unit: 7 }
    );
    expect(whereSql).toContain("aev.unit = ?");
    expect(values).toEqual(["2026-01-01", "2026-01-31", 7]);
  });
});

describe("groupStandardLedgerSections", () => {
  test("groups by payment mode with subtotals and grand total", () => {
    const rows = [
      { paymentMode: "Cash", amount: 100 },
      { paymentMode: "Cash", amount: 50 },
      { paymentMode: "UPI", amount: 200 }
    ];
    const { sections, grandTotal } = groupStandardLedgerSections(rows, {
      groupKey: "paymentMode",
      headerPrefix: "Payment Mode"
    });
    expect(sections).toHaveLength(2);
    expect(sections[0].headerLabel).toBe("Payment Mode: Cash");
    expect(sections[0].rows).toHaveLength(2);
    expect(sections[0].rows[0].slNo).toBe(1);
    expect(sections[0].subtotal.amount).toBe(150);
    expect(sections[1].subtotal.amount).toBe(200);
    expect(grandTotal.amount).toBe(350);
  });
});

describe("expense ledger data type constants", () => {
  test("exports expected data type strings", () => {
    expect(EXPENSE_LEDGER_DATA_TYPE_GENERAL).toBe("General");
    expect(EXPENSE_LEDGER_DATA_TYPE_PAYMENT_MODE).toBe("Payment Mode Wise");
    expect(EXPENSE_LEDGER_DATA_TYPE_EXPENSE_CATEGORY).toBe("Expense Category Wise");
  });
});
