import { getReportConfig } from "../../lib/reportConfig";
import { getReportFilterInitialValues } from "../../lib/reports/reportFilterDefaults";
import { getReportRunner } from "../../lib/reports/reportRegistry";
import { resolveVisibleReportColumns } from "../../lib/reports/resolveVisibleReportColumns";
import { buildExpenseLedgerWhereSql } from "../../lib/reports/report_expense_ledger";
import {
  ANNUAL_EXPENSE_LEDGER_DATA_TYPE_EXPENSE_CATEGORY,
  ANNUAL_EXPENSE_LEDGER_DATA_TYPE_SUMMARY,
  buildCategoryWiseSections,
  buildAnnualExpenseCategoryWiseSql,
  buildAnnualExpenseSummarySql
} from "../../lib/reports/report_annual_expense_ledger";

describe("report_annual_expense_ledger config", () => {
  test("getReportConfig returns grouped annual expense ledger report", () => {
    const cfg = getReportConfig("report_annual_expense_ledger");
    expect(cfg?.label).toBe("Annual Expense Ledger");
    expect(cfg?.group).toBe("Annual Accounts Reports");
    expect(cfg?.reportLayout?.title).toBe("ANNUAL EXPENSE LEDGER");
    expect(cfg?.fields?.find((f) => f.name === "financialYear")?.required).toBe(true);
    expect(cfg?.fields?.find((f) => f.name === "month")).toBeUndefined();
    expect(cfg?.fields?.find((f) => f.name === "dataType")?.default).toBe("Summary");
    expect(cfg?.reportLayout?.tableFitContent).toBe(true);
    expect(cfg?.reportLayout?.contentAlign).toBe("center");
    expect(cfg?.columns?.map((c) => c.key)).toEqual([
      "monthLabel",
      "expenseCategoryLabel",
      "byCard",
      "byCheque",
      "byCash",
      "byUpi"
    ]);
    expect(cfg?.columns?.find((c) => c.key === "monthLabel")?.hideWhenDataType).toBe(
      "Expense Category Wise"
    );
    expect(cfg?.columns?.find((c) => c.key === "expenseCategoryLabel")?.hideWhenDataType).toBe(
      "Summary"
    );
  });

  test("financial year and dataType defaults", () => {
    const cfg = getReportConfig("report_annual_expense_ledger");
    const values = getReportFilterInitialValues(cfg);
    expect(values.dataType).toBe("Summary");
    expect(values.outputFormat).toBe("HTML");
  });

  test("runner is registered", () => {
    expect(typeof getReportRunner("report_annual_expense_ledger")?.runReport).toBe("function");
  });
});

describe("resolveVisibleReportColumns annual expense data type columns", () => {
  test("summary shows month column and hides expense category column", () => {
    const cfg = getReportConfig("report_annual_expense_ledger");
    const visible = resolveVisibleReportColumns(cfg.columns, cfg.fields, { dataType: "Summary" });
    expect(visible.some((c) => c.key === "monthLabel")).toBe(true);
    expect(visible.some((c) => c.key === "expenseCategoryLabel")).toBe(false);
  });

  test("expense category wise shows expense category column and hides month column", () => {
    const cfg = getReportConfig("report_annual_expense_ledger");
    const visible = resolveVisibleReportColumns(cfg.columns, cfg.fields, {
      dataType: "Expense Category Wise"
    });
    expect(visible.some((c) => c.key === "monthLabel")).toBe(false);
    expect(visible.some((c) => c.key === "expenseCategoryLabel")).toBe(true);
  });
});

describe("buildExpenseLedgerWhereSql financial year range", () => {
  test("uses explicit date range when provided", () => {
    const { whereSql, values } = buildExpenseLedgerWhereSql({}, { from: "2025-04-01", to: "2026-03-31" });
    expect(whereSql).toContain("DATE(aev.date) >= ?");
    expect(whereSql).toContain("DATE(aev.date) <= ?");
    expect(values).toEqual(["2025-04-01", "2026-03-31"]);
  });
});

describe("buildAnnualExpenseSummarySql", () => {
  test("aggregates payment mode columns by npa current ac and month", () => {
    const { sql, values } = buildAnnualExpenseSummarySql({}, { from: "2025-04-01", to: "2026-03-31" });
    expect(sql).toContain("SUM(byCard) AS byCard");
    expect(sql).toContain("SUM(byCheque) AS byCheque");
    expect(sql).toContain("SUM(byCash) AS byCash");
    expect(sql).toContain("SUM(byUpi) AS byUpi");
    expect(sql).toContain("GROUP BY npaCurrentAcLabel, monthLabel, monthKey");
    expect(values).toEqual(["2025-04-01", "2026-03-31"]);
  });
});

describe("buildAnnualExpenseCategoryWiseSql", () => {
  test("groups by npa current ac, month, and expense category", () => {
    const { sql } = buildAnnualExpenseCategoryWiseSql({}, { from: "2025-04-01", to: "2026-03-31" });
    expect(sql).toContain("expenseCategoryLabel");
    expect(sql).toContain("GROUP BY npaCurrentAcLabel, monthLabel, monthKey, expenseCategoryLabel");
    expect(sql).toContain("ORDER BY npaCurrentAcLabel, monthKey, expenseCategoryLabel");
  });
});

describe("buildCategoryWiseSections", () => {
  test("builds NPA sections with nested month groups and totals", () => {
    const { sections, grandTotal } = buildCategoryWiseSections([
      {
        npaCurrentAcLabel: "AC1",
        monthLabel: "April-2025",
        expenseCategoryLabel: "Travel",
        byCard: 100,
        byCheque: 0,
        byCash: 20,
        byUpi: 0
      },
      {
        npaCurrentAcLabel: "AC1",
        monthLabel: "April-2025",
        expenseCategoryLabel: "Stationery",
        byCard: 0,
        byCheque: 50,
        byCash: 0,
        byUpi: 10
      }
    ]);
    expect(sections).toHaveLength(1);
    expect(sections[0].headerLabel).toBe("NPA Current AC: AC1");
    expect(sections[0].monthGroups).toHaveLength(1);
    expect(sections[0].monthGroups[0].headerLabel).toBe("Month: April-2025");
    expect(sections[0].monthGroups[0].rows[0].slNo).toBe(1);
    expect(sections[0].monthGroups[0].subtotal).toEqual({
      byCard: 100,
      byCheque: 50,
      byCash: 20,
      byUpi: 10
    });
    expect(sections[0].subtotal).toEqual({
      byCard: 100,
      byCheque: 50,
      byCash: 20,
      byUpi: 10
    });
    expect(grandTotal).toEqual({
      byCard: 100,
      byCheque: 50,
      byCash: 20,
      byUpi: 10
    });
  });
});

describe("annual expense data type constants", () => {
  test("exports expected strings", () => {
    expect(ANNUAL_EXPENSE_LEDGER_DATA_TYPE_SUMMARY).toBe("Summary");
    expect(ANNUAL_EXPENSE_LEDGER_DATA_TYPE_EXPENSE_CATEGORY).toBe("Expense Category Wise");
  });
});
