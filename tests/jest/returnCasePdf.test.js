// Test file — automated checks so changes do not break existing behaviour.

/**
 * Unit tests for Return Case PDF layout (lib/modules/returnCasePdf.js).
 *
 * Checks: file name sanitization, selected-row filter, PDF buffer is valid, 3 pages generated.
 * Does not pixel-compare the PDF — only smoke-tests generation.
 */
const {
  buildReturnCasePdfBuffer,
  countReturnCasePdfPages,
  filterSelectedReturnCaseDetails,
  safeReturnCasePdfFilename
} = require("../../lib/modules/returnCasePdf");

const samplePayload = {
  returnCase: {
    date: "2026-05-16",
    refNo: "RC/2627/0001",
    investigatingOfficerLabel: "Officer Name",
    borrowerLatestDetails: "Updated address and phone",
    ccTo: "Regional Manager, Mysore"
  },
  nciRow: {
    caseNo: "CASE-001",
    borrower: "Test Borrower",
    loanAccountNo: "1234567890",
    loanCategoryLabel: "SARFAESI",
    loanTypeLabel: "Term Loan",
    npaStatusLabel: "NPA",
    closureBalance: 100000,
    entrustmentDate: "2025-01-15"
  },
  branchContext: {
    bankName: "State Bank of India",
    branchDisplay: "Main Branch (001)",
    branchPlace: "Mysore",
    rboName: "RBO South"
  },
  unitShortCode: "MYS",
  returnCaseDetails: [
    { select: true, returnReason: "No contact with borrower" },
    { select: true, returnReason: "Property not traceable" }
  ],
  borrowerLatestDetails: "Updated address and phone",
  ccTo: "Regional Manager, Mysore"
};

// Checks printable PDF output is built without crashing and includes expected content.
describe("returnCasePdf", () => {
  test("safeReturnCasePdfFilename sanitizes ref no", () => {
    expect(safeReturnCasePdfFilename("RC/2627/0001")).toBe("RETURN_RC_2627_0001.pdf");
  });

  test("filterSelectedReturnCaseDetails keeps only checked rows", () => {
    const rows = [
      { select: true, returnReason: "A" },
      { select: false, returnReason: "B" },
      { select: 1, returnReason: "C" },
      { select: 0, returnReason: "D" }
    ];
    const filtered = filterSelectedReturnCaseDetails(rows);
    expect(filtered).toHaveLength(2);
    expect(filtered[0].returnReason).toBe("A");
    expect(filtered[1].returnReason).toBe("C");
  });

  test("buildReturnCasePdfBuffer returns non-empty buffer", async () => {
    const buf = await buildReturnCasePdfBuffer(samplePayload);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  test("document has exactly 3 pages (one per copy)", async () => {
    const pages = await countReturnCasePdfPages(samplePayload);
    expect(pages).toBe(3);
  });
});

