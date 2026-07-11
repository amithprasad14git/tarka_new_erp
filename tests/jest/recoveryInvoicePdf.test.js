// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `recoveryInvoicePdf`.
 * Run with: npm test
 */

const {
  buildRecoveryInvoicePdfBuffer,
  countRecoveryInvoicePdfPages,
  RECOVERY_INVOICE_RCM_NOTE
} = require("../../lib/modules/recoveryInvoicePdf");

const minimalPayload = {
  invoice: { date: "2026-05-16", invoiceNo: "INV/2627/0008" },
  charges: [{ percentage: 5, amount: 5000 }],
  nciRow: {
    borrower: "Test Borrower",
    loanAccountNo: "1234567890",
    loanTypeLabel: "Education Loan",
    npaDate: "2026-01-01",
    caseStatusLabel: "Under Progress",
    caseNo: "B/CF/10003"
  },
  amountRecoveredRows: [{ recoveredDate: "2026-05-01", recoveredAmount: 305690 }],
  branchContext: {
    bankName: "State Bank of India",
    branchDisplay: "Mandya (040001)",
    branchPlace: "Mandya",
    rboName: "RBO Mysore",
    bankCode: "SBI"
  },
  unitShortCode: "Unit 1",
  currentAccount: {
    accountName: "NPA Enforcement & Recovery Squad (P) Ltd.",
    bankName: "State Bank of India",
    branch: "SBI Siddartha Layout",
    accountNo: "40020692454",
    ifscCode: "SBIN0016501",
    gstNo: "29AAHCN2327CGST",
    bankCode: "SBI"
  }
};

// Checks printable PDF output is built without crashing and includes expected content.
describe("recoveryInvoicePdf", () => {
  test("buildRecoveryInvoicePdfBuffer returns a non-empty buffer", async () => {
    const buf = await buildRecoveryInvoicePdfBuffer(minimalPayload);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  test("document has exactly 3 pages (one per copy)", async () => {
    const pages = await countRecoveryInvoicePdfPages(minimalPayload);
    expect(pages).toBe(3);
  });

  test("RCM note includes full notification date (not clipped at 'dated')", () => {
    expect(RECOVERY_INVOICE_RCM_NOTE).toContain("28/06/2017");
    expect(RECOVERY_INVOICE_RCM_NOTE).toContain("Central Tax (Rate) dated");
    expect(RECOVERY_INVOICE_RCM_NOTE).toMatch(/Central Tax \(Rate\) dated 28\/06\/2017/);
  });
});


