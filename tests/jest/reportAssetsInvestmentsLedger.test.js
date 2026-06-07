import { getReportConfig } from "../../lib/reportConfig";
import { getReportFilterInitialValues } from "../../lib/reports/reportFilterDefaults";
import { buildFilterSummaryText } from "../../lib/reports/buildFilterSummary";
import { getReportRunner } from "../../lib/reports/reportRegistry";
import { validateReportFilters } from "../../lib/reports/reportFilterValidation";
import {
  monthEndYmd,
  monthStartYmd,
  validateMonthRange
} from "../../lib/reports/monthFilterRange";
import {
  buildAssetsInvestmentsLedgerWhereSql,
  validateReportFilters as validateLedgerReportFilters
} from "../../lib/reports/report_assets_investments_ledger";

describe("report_assets_investments_ledger config", () => {
  test("getReportConfig returns standard table report", () => {
    const cfg = getReportConfig("report_assets_investments_ledger");
    expect(cfg?.label).toMatch(/Assets & Investments Ledger/i);
    expect(cfg?.group).toBe("Accounts Reports");
    expect(cfg?.reportLayout?.title).toBe("ASSETS & INVESTMENTS LEDGER");
    expect(cfg?.reportLayout?.mode).toBeUndefined();
    expect(cfg?.fields?.find((f) => f.name === "fromMonth")?.type).toBe("month");
    expect(cfg?.fields?.find((f) => f.name === "toMonth")?.required).toBe(true);
    expect(cfg?.columns?.map((c) => c.key)).toEqual([
      "slNo",
      "voucherNo",
      "date",
      "unitLabel",
      "paidToLabel",
      "remarks",
      "paymentMode",
      "npaCurrentAcLabel",
      "chequeNo",
      "chequeDate",
      "inFavourOf",
      "amount"
    ]);
    expect(cfg?.columns?.find((c) => c.key === "amount")?.sum).toBe(true);
    expect(cfg?.reportStyle?.totalRow?.labelColumn).toBe("voucherNo");
  });

  test("month filters default to current month", () => {
    const cfg = getReportConfig("report_assets_investments_ledger");
    const values = getReportFilterInitialValues(cfg);
    expect(values.fromMonth).toMatch(/^\d{4}-\d{2}$/);
    expect(values.toMonth).toMatch(/^\d{4}-\d{2}$/);
    expect(values.outputFormat).toBe("HTML");
  });

  test("runner is registered", () => {
    expect(typeof getReportRunner("report_assets_investments_ledger")?.runReport).toBe("function");
    expect(typeof getReportRunner("report_assets_investments_ledger")?.validateReportFilters).toBe(
      "function"
    );
  });
});

describe("monthFilterRange", () => {
  test("monthStartYmd and monthEndYmd", () => {
    expect(monthStartYmd("2026-04")).toBe("2026-04-01");
    expect(monthEndYmd("2026-04")).toBe("2026-04-30");
    expect(monthEndYmd("2026-02")).toBe("2026-02-28");
  });

  test("validateMonthRange rejects inverted range", () => {
    expect(validateMonthRange("2026-05", "2026-04")).toMatch(/cannot be after/i);
    expect(validateMonthRange("2026-04", "2026-05")).toBeNull();
  });
});

describe("buildAssetsInvestmentsLedgerWhereSql", () => {
  test("always applies month date bounds", () => {
    const { whereSql, values } = buildAssetsInvestmentsLedgerWhereSql({
      fromMonth: "2026-01",
      toMonth: "2026-03"
    });
    expect(whereSql).toContain("DATE(aai.date) >= ?");
    expect(whereSql).toContain("DATE(aai.date) <= ?");
    expect(values).toEqual(["2026-01-01", "2026-03-31"]);
  });

  test("applies optional filters for admin user", () => {
    const { whereSql, values } = buildAssetsInvestmentsLedgerWhereSql(
      {
        fromMonth: "2026-01",
        toMonth: "2026-01",
        unit: "3",
        paidTo: "10",
        paymentMode: "Cheque",
        npaCurrentAc: "7"
      },
      { role: 1 }
    );
    expect(whereSql).toContain("aai.unit = ?");
    expect(whereSql).toContain("aai.paidTo = ?");
    expect(whereSql).toContain("aai.paymentMode = ?");
    expect(whereSql).toContain("aai.npaCurrentAc = ?");
    expect(values).toEqual([
      "2026-01-01",
      "2026-01-31",
      3,
      10,
      "Cheque",
      7
    ]);
  });

  test("role 2 enforces session unit and ignores unit filter", () => {
    const { whereSql, values } = buildAssetsInvestmentsLedgerWhereSql(
      {
        fromMonth: "2026-01",
        toMonth: "2026-01",
        unit: "99"
      },
      { role: 2, unit: 5 }
    );
    expect(whereSql).toContain("aai.unit = ?");
    expect(values).toEqual(["2026-01-01", "2026-01-31", 5]);
  });

  test("role 2 with no session unit returns no rows", () => {
    const { whereSql, values } = buildAssetsInvestmentsLedgerWhereSql(
      { fromMonth: "2026-01", toMonth: "2026-01" },
      { role: 2 }
    );
    expect(whereSql).toContain("1=0");
    expect(values).toEqual(["2026-01-01", "2026-01-31"]);
  });
});

describe("validateReportFilters with ledger runner", () => {
  test("rejects fromMonth after toMonth via runner hook", () => {
    const cfg = getReportConfig("report_assets_investments_ledger");
    const runner = getReportRunner("report_assets_investments_ledger");
    const err = validateReportFilters(
      cfg,
      {
        fromMonth: "2026-06",
        toMonth: "2026-05",
        outputFormat: "HTML"
      },
      runner
    );
    expect(err).toMatch(/cannot be after/i);
  });

  test("validateLedgerReportFilters delegates to month range", () => {
    expect(
      validateLedgerReportFilters(null, { fromMonth: "2026-02", toMonth: "2026-01" })
    ).toMatch(/cannot be after/i);
  });
});

describe("buildFilterSummaryText month labels", () => {
  test("formats month filters as MM/YYYY", () => {
    const cfg = getReportConfig("report_assets_investments_ledger");
    const summary = buildFilterSummaryText(cfg, {
      fromMonth: "2026-01",
      toMonth: "2026-03",
      paymentMode: "Cash"
    });
    expect(summary).toContain("From Month: 01/2026");
    expect(summary).toContain("To Month: 03/2026");
    expect(summary).toContain("Payment Mode: Cash");
  });
});
