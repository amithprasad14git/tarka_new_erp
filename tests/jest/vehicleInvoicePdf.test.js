// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `vehicleInvoicePdf`.
 * Run with: npm test
 */

const { buildVehicleInvoicePdfBuffer, countVehicleInvoicePdfPages } = require("../../lib/modules/vehicleInvoicePdf");

const minimalPayload = {
  invoice: { date: "2026-05-16", invoiceNo: "VEH/2627/0001" },
  charges: [
    {
      particularsLabel: "Seizing Charges",
      remarks: "As per agreement",
      amount: 15000
    }
  ],
  nciRow: {
    borrower: "Test Borrower",
    loanAccountNo: "1234567890",
    loanTypeLabel: "Vehicle Loan",
    caseNo: "V/AL/14528"
  },
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
describe("vehicleInvoicePdf", () => {
  test("buildVehicleInvoicePdfBuffer returns a non-empty buffer", async () => {
    const buf = await buildVehicleInvoicePdfBuffer(minimalPayload);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  test("document has exactly 3 pages (one per copy)", async () => {
    const pages = await countVehicleInvoicePdfPages(minimalPayload);
    expect(pages).toBe(3);
  });
});


