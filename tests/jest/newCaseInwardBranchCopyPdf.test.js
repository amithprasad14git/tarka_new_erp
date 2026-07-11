// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `newCaseInwardBranchCopyPdf`.
 * Run with: npm test
 */

const {
  buildNewCaseInwardBranchCopyPdf,
  countBranchCopyPdfPages
} = require("../../lib/modules/newCaseInwardBranchCopyPdf");

const minimalPayload = {
  data: {
    caseNo: "B/CF/10003",
    borrower: "Test Borrower",
    loanAccountNo: "1234567890",
    loanTypeLabel: "Education Loan",
    npaStatusLabel: "NPA",
    closureBalance: 50000,
    entrustmentDate: "2026-01-15",
    receivedFromLabel: "Branch Manager"
  },
  bankName: "State Bank of India",
  bankShortCode: "SBI",
  branchLabel: "Mandya (040001)",
  place: "Mandya",
  rboName: "RBO Mysore",
  signatoryName: "Amith Prasad",
  unitCode: "Unit 1"
};

describe("newCaseInwardBranchCopyPdf", () => {
  test("buildNewCaseInwardBranchCopyPdf returns a non-empty buffer", async () => {
    const buf = await buildNewCaseInwardBranchCopyPdf(minimalPayload);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  test("document has exactly 2 pages (Branch Copy and RBO/RO/ZO Copy)", async () => {
    const pages = await countBranchCopyPdfPages(minimalPayload);
    expect(pages).toBe(2);
  });
});

