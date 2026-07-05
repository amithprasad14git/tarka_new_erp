/**
 * Tests for Recovery Invoice view grid status dot tone.
 */

jest.mock("../../lib/gridRowValue", () => ({
  rowValueForField: (row, field) => (row && Object.prototype.hasOwnProperty.call(row, field) ? row[field] : null)
}));

const {
  getRecoveryInvoiceDotTone,
  recoveryInvoiceDotLabel
} = require("../../lib/modules/recoveryInvoiceClient");

describe("getRecoveryInvoiceDotTone", () => {
  test("returns cancelled when cancelledInvoice is Yes", () => {
    expect(getRecoveryInvoiceDotTone({ cancelledInvoice: "Yes" })).toBe("cancelled");
    expect(getRecoveryInvoiceDotTone({ cancelledInvoice: "yes" })).toBe("cancelled");
  });

  test("returns received when linked Invoices Received row exists", () => {
    expect(getRecoveryInvoiceDotTone({ cancelledInvoice: "No", _hasInvoicesReceived: true })).toBe(
      "received"
    );
  });

  test("returns pending when not cancelled and not received", () => {
    expect(getRecoveryInvoiceDotTone({ cancelledInvoice: "No" })).toBe("pending");
    expect(getRecoveryInvoiceDotTone({})).toBe("pending");
  });

  test("cancelled takes priority over received", () => {
    expect(
      getRecoveryInvoiceDotTone({ cancelledInvoice: "Yes", _hasInvoicesReceived: true })
    ).toBe("cancelled");
  });
});

describe("recoveryInvoiceDotLabel", () => {
  test("maps tones to accessible labels", () => {
    expect(recoveryInvoiceDotLabel("cancelled")).toBe("Cancelled invoice");
    expect(recoveryInvoiceDotLabel("received")).toBe("Received invoice");
    expect(recoveryInvoiceDotLabel("pending")).toBe("Pending invoice");
  });
});
