/**
 * Tests for SARFAESI Invoice view grid status dot tone.
 */

jest.mock("../../lib/gridRowValue", () => ({
  rowValueForField: (row, field) => (row && Object.prototype.hasOwnProperty.call(row, field) ? row[field] : null)
}));

const {
  getSarfaesiInvoiceDotTone,
  sarfaesiInvoiceDotLabel
} = require("../../lib/modules/sarfaesiInvoiceClient");

describe("getSarfaesiInvoiceDotTone", () => {
  test("returns cancelled when cancelledInvoice is Yes", () => {
    expect(getSarfaesiInvoiceDotTone({ cancelledInvoice: "Yes" })).toBe("cancelled");
    expect(getSarfaesiInvoiceDotTone({ cancelledInvoice: "yes" })).toBe("cancelled");
  });

  test("returns received when linked Invoices Received row exists", () => {
    expect(getSarfaesiInvoiceDotTone({ cancelledInvoice: "No", _hasInvoicesReceived: true })).toBe(
      "received"
    );
  });

  test("returns pending when not cancelled and not received", () => {
    expect(getSarfaesiInvoiceDotTone({ cancelledInvoice: "No" })).toBe("pending");
    expect(getSarfaesiInvoiceDotTone({})).toBe("pending");
  });

  test("cancelled takes priority over received", () => {
    expect(
      getSarfaesiInvoiceDotTone({ cancelledInvoice: "Yes", _hasInvoicesReceived: true })
    ).toBe("cancelled");
  });
});

describe("sarfaesiInvoiceDotLabel", () => {
  test("maps tones to accessible labels", () => {
    expect(sarfaesiInvoiceDotLabel("cancelled")).toBe("Cancelled invoice");
    expect(sarfaesiInvoiceDotLabel("received")).toBe("Received invoice");
    expect(sarfaesiInvoiceDotLabel("pending")).toBe("Pending invoice");
  });
});
