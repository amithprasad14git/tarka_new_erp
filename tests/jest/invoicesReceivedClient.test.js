// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `invoicesReceivedClient`.
 * Run with: npm test
 */

const { computeInvoicesReceivedAmounts } = require("../../lib/modules/invoicesReceivedAmounts");
const {
  buildInvoicesReceivedDraftFromRow,
  normalizeInvoiceFkId
} = require("../../lib/modules/invoicesReceivedFk");

// Checks money amounts convert to the correct words for invoices and letters.
describe("computeInvoicesReceivedAmounts", () => {
  test("empty TDS % yields zero TDS and received equals billed", () => {
    expect(computeInvoicesReceivedAmounts({ billedAmount: 1000, tdsPercentage: "", roundOff: "" })).toEqual({
      tdsPercentage: 0,
      tdsAmount: 0,
      receivedAmount: 1000
    });
  });

  test("Round Down uses ceil on TDS and received", () => {
    const r = computeInvoicesReceivedAmounts({
      billedAmount: 1000,
      tdsPercentage: 10,
      roundOff: "Round Down"
    });
    expect(r.tdsAmount).toBe(100);
    expect(r.receivedAmount).toBe(900);
  });

  test("Round Up uses floor on TDS and received", () => {
    const r = computeInvoicesReceivedAmounts({
      billedAmount: 1000,
      tdsPercentage: 10,
      roundOff: "Round Up"
    });
    expect(r.tdsAmount).toBe(100);
    expect(r.receivedAmount).toBe(900);
  });

  test("no round off uses raw float math", () => {
    const r = computeInvoicesReceivedAmounts({
      billedAmount: 1000,
      tdsPercentage: 10,
      roundOff: ""
    });
    expect(r.tdsAmount).toBe(100);
    expect(r.receivedAmount).toBe(900);
  });
});

describe("invoicesReceivedClient invoice FK normalization", () => {
  test("normalizeInvoiceFkId treats 0 and empty as unset", () => {
    expect(normalizeInvoiceFkId(0)).toBe("");
    expect(normalizeInvoiceFkId("0")).toBe("");
    expect(normalizeInvoiceFkId(null)).toBe("");
    expect(normalizeInvoiceFkId("")).toBe("");
    expect(normalizeInvoiceFkId(12)).toBe("12");
    expect(normalizeInvoiceFkId("12")).toBe("12");
  });

  test("buildInvoicesReceivedDraftFromRow clears unused invoice slots with legacy 0", () => {
    const draft = buildInvoicesReceivedDraftFromRow({
      recoveryInvoice: 5,
      recoveryInvoiceLabel: "RI/1",
      sarfaesiInvoice: 0,
      sarfaesiInvoiceLabel: "should-not-show",
      vehicleInvoice: 0
    });
    expect(draft.recoveryInvoice).toBe("5");
    expect(draft.recoveryInvoiceLabel).toBe("RI/1");
    expect(draft.sarfaesiInvoice).toBe("");
    expect(draft.sarfaesiInvoiceLabel).toBe("");
    expect(draft.vehicleInvoice).toBe("");
    expect(draft.vehicleInvoiceLabel).toBe("");
  });
});

