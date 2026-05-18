const { computeInvoicesReceivedAmounts } = require("../../lib/modules/invoicesReceivedAmounts");

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
