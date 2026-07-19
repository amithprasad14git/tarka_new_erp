// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `sarfaesiCaseStatusUpdateNpaAckPdf`.
 * Run with: npm test
 */

const {
  buildSarfaesiNpaAckPdfBuffer,
  countSarfaesiNpaAckPdfPages,
  safeSarfaesiNpaAckPdfFilename,
  NPA_ACK_TITLE,
  NPA_ACK_DOCUMENT_LINES
} = require("../../lib/modules/sarfaesiCaseStatusUpdateNpaAckPdf");

const minimalPayload = {
  nciRow: {
    borrower: "Test Borrower",
    loanAccountNo: "1234567890",
    loanTypeLabel: "ABAL - Asset Backed Agri Loan",
    fileMaintenanceLabel: "Branch Custody"
  },
  branchContext: {
    bankName: "State Bank of India",
    branchDisplay: "K M Doddi (040230)",
    branchPlace: "K M Doddi",
    rboName: "SBI RBO 3 Mandya"
  }
};

describe("sarfaesiCaseStatusUpdateNpaAckPdf", () => {
  test("buildSarfaesiNpaAckPdfBuffer returns a non-empty buffer", async () => {
    const buf = await buildSarfaesiNpaAckPdfBuffer(minimalPayload);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  test("document has exactly 1 page (two halves on one sheet)", async () => {
    const pages = await countSarfaesiNpaAckPdfPages(minimalPayload);
    expect(pages).toBe(1);
  });

  test("safe filename and fixed wording", () => {
    expect(safeSarfaesiNpaAckPdfFilename("SRFUP/2627/0001")).toBe("NPA_ACK_SRFUP_2627_0001.pdf");
    expect(NPA_ACK_TITLE).toBe("BRANCH ACKNOWLEDGEMENT — SARFAESI NOTICES / DOCUMENTS");
    expect(NPA_ACK_DOCUMENT_LINES).toHaveLength(10);
    expect(NPA_ACK_DOCUMENT_LINES[0]).toMatch(/13\(2\) Demand Notice/);
    expect(NPA_ACK_DOCUMENT_LINES[8]).toBe("13(4) Photographs");
  });
});
