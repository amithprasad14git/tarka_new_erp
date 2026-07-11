// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `sarfaesiCaseStatusUpdateCovering132Pdf`.
 * Run with: npm test
 */

const {
  buildSarfaesiCovering132PdfBuffer,
  buildSarfaesiCovering132PaperPublicationPdfBuffer,
  countSarfaesiCovering132PdfPages,
  countSarfaesiCovering132PaperPublicationPdfPages,
  resolveDateOf132,
  resolvePaperPublicationDate,
  safeSarfaesiCovering132PdfFilename,
  safeSarfaesiCovering132PaperPublicationPdfFilename,
  isCovering132ParticularLabel,
  isCovering132PaperPublicationParticularLabel,
  COVERING_132_INTRO,
  COVERING_132_NOTE,
  COVERING_132_PAPER_PUB_TITLE,
  COVERING_132_PAPER_PUB_INTRO,
  COVERING_132_PAPER_PUB_NOTE
} = require("../../lib/modules/sarfaesiCaseStatusUpdateCovering132Pdf");

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
    { particularsLabel: "Date of 13(2)", remarks: "2026-06-24" },
    { particularsLabel: "Other particular", remarks: "n/a" }
  ]
};

const paperPubPayload = {
  ...minimalPayload,
  detailRows: [
    { particularsLabel: "Date of 13(2)", remarks: "2026-06-24" },
    {
      particularsLabel: "13(2) Acknowledgements Received?",
      remarks: "2026-07-01"
    }
  ]
};

describe("sarfaesiCaseStatusUpdateCovering132Pdf", () => {
  test("buildSarfaesiCovering132PdfBuffer returns a non-empty buffer", async () => {
    const buf = await buildSarfaesiCovering132PdfBuffer(minimalPayload);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  test("document has exactly 1 page (two halves on one sheet)", async () => {
    const pages = await countSarfaesiCovering132PdfPages(minimalPayload);
    expect(pages).toBe(1);
  });

  test("resolveDateOf132 prefers matching particular remarks", () => {
    expect(
      resolveDateOf132(
        [{ particularsLabel: "Date of 13(2)", remarks: "2026-06-24" }],
        "2026-01-01"
      )
    ).toBe("24/06/2026");
  });

  test("resolveDateOf132 ignores acknowledgements particular", () => {
    expect(
      resolveDateOf132(
        [
          {
            particularsLabel: "13(2) Acknowledgements Received?",
            remarks: "2026-07-01"
          }
        ],
        "2026-01-01"
      )
    ).toBe("01/01/2026");
  });

  test("resolveDateOf132 falls back to parent date", () => {
    expect(resolveDateOf132([{ particularsLabel: "Other", remarks: "x" }], "2026-07-11")).toBe(
      "11/07/2026"
    );
  });

  test("safe filename and fixed wording", () => {
    expect(safeSarfaesiCovering132PdfFilename("SRFUP/2627/0001")).toBe(
      "COVERING_132_SRFUP_2627_0001.pdf"
    );
    expect(COVERING_132_INTRO).toMatch(/13\(2\) Demand Notice/i);
    expect(COVERING_132_NOTE).toMatch(/Acknowledgement Due/i);
    expect(COVERING_132_NOTE).toMatch(/has been despatched/i);
  });
});

describe("sarfaesiCaseStatusUpdateCovering132Pdf paper publication", () => {
  test("particular label matchers", () => {
    expect(isCovering132PaperPublicationParticularLabel("13(2) Acknowledgements Received?")).toBe(
      true
    );
    expect(isCovering132ParticularLabel("13(2) Acknowledgements Received?")).toBe(false);
    expect(isCovering132ParticularLabel("Date of 13(2)")).toBe(true);
  });

  test("resolvePaperPublicationDate prefers acknowledgements remarks", () => {
    expect(
      resolvePaperPublicationDate(
        [
          { particularsLabel: "Date of 13(2)", remarks: "2026-06-24" },
          {
            particularsLabel: "13(2) Acknowledgements Received?",
            remarks: "2026-07-01"
          }
        ],
        "2026-01-01"
      )
    ).toBe("01/07/2026");
  });

  test("resolvePaperPublicationDate falls back to parent date", () => {
    expect(
      resolvePaperPublicationDate(
        [{ particularsLabel: "Date of 13(2)", remarks: "2026-06-24" }],
        "2026-07-11"
      )
    ).toBe("11/07/2026");
  });

  test("paper publication buffer builds one page", async () => {
    const buf = await buildSarfaesiCovering132PaperPublicationPdfBuffer(paperPubPayload);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
    expect(await countSarfaesiCovering132PaperPublicationPdfPages(paperPubPayload)).toBe(1);
  });

  test("paper publication filename and wording", () => {
    expect(safeSarfaesiCovering132PaperPublicationPdfFilename("SRFUP/2627/0001")).toBe(
      "COVERING_132_PAPER_PUB_SRFUP_2627_0001.pdf"
    );
    expect(COVERING_132_PAPER_PUB_TITLE).toMatch(/PAPER PUBLICATION/i);
    expect(COVERING_132_PAPER_PUB_INTRO).toMatch(/paper publication/i);
    expect(COVERING_132_PAPER_PUB_NOTE).toMatch(/newspaper/i);
  });
});
