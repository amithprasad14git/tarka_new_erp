// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `sarfaesiCaseStatusUpdateCovering134Pdf`.
 * Run with: npm test
 */

const {
  buildSarfaesiCovering134PdfBuffer,
  countSarfaesiCovering134PdfPages,
  resolveDateOf134,
  safeSarfaesiCovering134PdfFilename,
  isCovering134ParticularLabel,
  COVERING_134_TITLE,
  COVERING_134_INTRO,
  COVERING_134_NOTE
} = require("../../lib/modules/sarfaesiCaseStatusUpdateCovering134Pdf");

const minimalPayload = {
  statusUpdate: { date: "2026-06-24", refNo: "SRFUP/2627/0001" },
  nciRow: {
    borrower: "Test Borrower",
    loanAccountNo: "1234567890",
    loanTypeLabel: "ABAL - Asset Backed Agri Loan"
  },
  branchContext: {
    bankName: "State Bank of India",
    branchDisplay: "K M Doddi (040230)",
    branchPlace: "K M Doddi",
    rboName: "SBI RBO 3 Mandya"
  },
  signatoryName: "Amith Prasad",
  detailRows: [
    { particularsLabel: "Date of 13(4)", remarks: "2026-07-05" },
    { particularsLabel: "Date of 13(2)", remarks: "2026-06-24" }
  ]
};

describe("sarfaesiCaseStatusUpdateCovering134Pdf", () => {
  test("buildSarfaesiCovering134PdfBuffer returns a non-empty buffer", async () => {
    const buf = await buildSarfaesiCovering134PdfBuffer(minimalPayload);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  test("document has exactly 1 page (two halves on one sheet)", async () => {
    const pages = await countSarfaesiCovering134PdfPages(minimalPayload);
    expect(pages).toBe(1);
  });

  test("particular label matcher", () => {
    expect(isCovering134ParticularLabel("Date of 13(4)")).toBe(true);
    expect(isCovering134ParticularLabel("Date of 13(2)")).toBe(false);
  });

  test("resolveDateOf134 prefers matching particular remarks", () => {
    expect(
      resolveDateOf134(
        [
          { particularsLabel: "Date of 13(2)", remarks: "2026-06-24" },
          { particularsLabel: "Date of 13(4)", remarks: "2026-07-05" }
        ],
        "2026-01-01"
      )
    ).toBe("05/07/2026");
  });

  test("resolveDateOf134 falls back to parent date", () => {
    expect(resolveDateOf134([{ particularsLabel: "Other", remarks: "x" }], "2026-07-11")).toBe(
      "11/07/2026"
    );
  });

  test("safe filename and fixed wording", () => {
    expect(safeSarfaesiCovering134PdfFilename("SRFUP/2627/0001")).toBe(
      "COVERING_134_SRFUP_2627_0001.pdf"
    );
    expect(COVERING_134_TITLE).toBe("13(4) NOTICE");
    expect(COVERING_134_INTRO).toMatch(/13\(4\) notice/i);
    expect(COVERING_134_NOTE).toMatch(/Speed Post/i);
    expect(COVERING_134_NOTE).toMatch(/has been despatched/i);
  });
});
