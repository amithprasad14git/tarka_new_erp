import { getYmdISTFromInstant } from "../../lib/istDateTime";
import { getReportConfig } from "../../lib/reportConfig";
import { getReportFilterInitialValues } from "../../lib/reports/reportFilterDefaults";
import { buildFilterSummaryText } from "../../lib/reports/buildFilterSummary";
import { getReportRunner } from "../../lib/reports/reportRegistry";
import {
  buildLoanAccountLedgerWhereSql,
  splitLoanLedgerAmounts
} from "../../lib/reports/report_loan_account_ledger";

describe("report_loan_account_ledger config", () => {
  test("getReportConfig returns standard table report", () => {
    const cfg = getReportConfig("report_loan_account_ledger");
    expect(cfg?.label).toMatch(/Loan Account Ledger/i);
    expect(cfg?.group).toBe("Accounts Reports");
    expect(cfg?.reportLayout?.title).toBe("LOAN ACCOUNT LEDGER");
    expect(cfg?.reportLayout?.mode).toBeUndefined();
    expect(cfg?.fields?.find((f) => f.name === "asOnDate")?.required).toBe(true);
    expect(cfg?.fields?.find((f) => f.name === "transactionType")?.ui?.emptyOptionLabel).toBe("All");
    expect(cfg?.fields?.find((f) => f.name === "transactionType")?.required).toBeUndefined();
    expect(cfg?.filterCascade).toEqual([{ parent: "unit", child: "npaCurrentAc", lovParam: "f_unit" }]);
    expect(cfg?.columns?.map((c) => c.key)).toEqual([
      "slNo",
      "voucherNo",
      "date",
      "unitLabel",
      "transactionType",
      "partyLabel",
      "remarks",
      "paymentMode",
      "npaCurrentAcLabel",
      "chequeNo",
      "chequeDate",
      "inFavourOf",
      "receiptAmount",
      "paymentAmount"
    ]);
    expect(cfg?.columns?.find((c) => c.key === "receiptAmount")?.sum).toBe(true);
    expect(cfg?.columns?.find((c) => c.key === "paymentAmount")?.sum).toBe(true);
    expect(cfg?.reportStyle?.totalRow?.labelColumn).toBe("voucherNo");
  });

  test("asOnDate defaults to today in IST", () => {
    const cfg = getReportConfig("report_loan_account_ledger");
    const values = getReportFilterInitialValues(cfg);
    expect(values.asOnDate).toBe(getYmdISTFromInstant(new Date()));
    expect(values.outputFormat).toBe("HTML");
  });

  test("runner is registered", () => {
    expect(typeof getReportRunner("report_loan_account_ledger")?.runReport).toBe("function");
  });
});

describe("buildLoanAccountLedgerWhereSql", () => {
  test("applies cumulative as-on date bound", () => {
    const { whereSql, values } = buildLoanAccountLedgerWhereSql({ asOnDate: "2026-06-15" });
    expect(whereSql).toContain("DATE(ala.date) <= ?");
    expect(values).toEqual(["2026-06-15"]);
  });

  test("empty transaction type does not add predicate", () => {
    const { whereSql, values } = buildLoanAccountLedgerWhereSql({
      asOnDate: "2026-06-15",
      transactionType: ""
    });
    expect(whereSql).not.toContain("ala.transactionType = ?");
    expect(values).toEqual(["2026-06-15"]);
  });

  test("applies optional filters when set in header", () => {
    const { whereSql, values } = buildLoanAccountLedgerWhereSql({
      asOnDate: "2026-01-31",
      unit: "3",
      npaCurrentAc: "7",
      transactionType: "Receipt",
      paymentMode: "Cash",
      party: "12"
    });
    expect(whereSql).toContain("ala.unit = ?");
    expect(whereSql).toContain("ala.npaCurrentAc = ?");
    expect(whereSql).toContain("ala.transactionType = ?");
    expect(whereSql).toContain("ala.paymentMode = ?");
    expect(whereSql).toContain("ala.party = ?");
    expect(values).toEqual(["2026-01-31", 3, 7, "Receipt", "Cash", 12]);
  });

  test("does not apply unit filter when unit header is empty", () => {
    const { whereSql, values } = buildLoanAccountLedgerWhereSql({
      asOnDate: "2026-04-01",
      transactionType: "Payment"
    });
    expect(whereSql).not.toContain("ala.unit = ?");
    expect(whereSql).not.toContain("1=0");
    expect(whereSql).toContain("ala.transactionType = ?");
    expect(values).toEqual(["2026-04-01", "Payment"]);
  });
});

describe("splitLoanLedgerAmounts", () => {
  test("receipt rows populate receipt amount only", () => {
    expect(splitLoanLedgerAmounts("Receipt", 1500)).toEqual({
      receiptAmount: 1500,
      paymentAmount: ""
    });
  });

  test("payment rows populate payment amount only", () => {
    expect(splitLoanLedgerAmounts("Payment", 2500.5)).toEqual({
      receiptAmount: "",
      paymentAmount: 2500.5
    });
  });

  test("zero or unknown type leaves both columns empty", () => {
    expect(splitLoanLedgerAmounts("Receipt", 0)).toEqual({ receiptAmount: "", paymentAmount: "" });
    expect(splitLoanLedgerAmounts("Other", 100)).toEqual({ receiptAmount: "", paymentAmount: "" });
  });
});

describe("buildFilterSummaryText as-on date label", () => {
  test("formats as on date filter as DD-MM-YYYY", () => {
    const cfg = getReportConfig("report_loan_account_ledger");
    const summary = buildFilterSummaryText(cfg, {
      asOnDate: "2026-06-02",
      transactionType: "Receipt"
    });
    expect(summary).toContain("As on Date: 02-06-2026");
    expect(summary).toContain("Transaction Type: Receipt");
  });
});
