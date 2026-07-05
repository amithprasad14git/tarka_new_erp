/**
 * Tests for Vehicle Invoice view grid status dot tone.
 */

jest.mock("../../lib/gridRowValue", () => ({
  rowValueForField: (row, field) => (row && Object.prototype.hasOwnProperty.call(row, field) ? row[field] : null)
}));

const {
  getVehicleInvoiceDotTone,
  vehicleInvoiceDotLabel
} = require("../../lib/modules/vehicleInvoiceClient");

describe("getVehicleInvoiceDotTone", () => {
  test("returns cancelled when cancelledInvoice is Yes", () => {
    expect(getVehicleInvoiceDotTone({ cancelledInvoice: "Yes" })).toBe("cancelled");
    expect(getVehicleInvoiceDotTone({ cancelledInvoice: "yes" })).toBe("cancelled");
  });

  test("returns received when linked Invoices Received row exists", () => {
    expect(getVehicleInvoiceDotTone({ cancelledInvoice: "No", _hasInvoicesReceived: true })).toBe(
      "received"
    );
  });

  test("returns pending when not cancelled and not received", () => {
    expect(getVehicleInvoiceDotTone({ cancelledInvoice: "No" })).toBe("pending");
    expect(getVehicleInvoiceDotTone({})).toBe("pending");
  });

  test("cancelled takes priority over received", () => {
    expect(
      getVehicleInvoiceDotTone({ cancelledInvoice: "Yes", _hasInvoicesReceived: true })
    ).toBe("cancelled");
  });
});

describe("vehicleInvoiceDotLabel", () => {
  test("maps tones to accessible labels", () => {
    expect(vehicleInvoiceDotLabel("cancelled")).toBe("Cancelled invoice");
    expect(vehicleInvoiceDotLabel("received")).toBe("Received invoice");
    expect(vehicleInvoiceDotLabel("pending")).toBe("Pending invoice");
  });
});
