import {
  appendNciUnitFilterIfSelected,
  appendInvoiceBillToUnitFilterIfSelected,
  appendInvoicesReceivedBillToUnitFilterIfSelected
} from "../../lib/reports/nciReportDimensionFilters";

describe("appendNciUnitFilterIfSelected", () => {
  test("adds nci.unit when unit filter is set", () => {
    const parts = [];
    const values = [];
    appendNciUnitFilterIfSelected({ unit: "3" }, parts, values);
    expect(parts).toEqual(["nci.unit = ?"]);
    expect(values).toEqual([3]);
  });

  test("does nothing when unit filter is empty", () => {
    const parts = [];
    const values = [];
    appendNciUnitFilterIfSelected({}, parts, values);
    expect(parts).toEqual([]);
    expect(values).toEqual([]);
  });

  test("supports custom nci alias", () => {
    const parts = [];
    const values = [];
    appendNciUnitFilterIfSelected({ unit: "1" }, parts, values, "nci_alias");
    expect(parts).toEqual(["nci_alias.unit = ?"]);
    expect(values).toEqual([1]);
  });
});

describe("appendInvoiceBillToUnitFilterIfSelected", () => {
  test("adds inv.billToUnit when unit filter is set", () => {
    const parts = [];
    const values = [];
    appendInvoiceBillToUnitFilterIfSelected({ unit: "3" }, parts, values);
    expect(parts).toEqual(["inv.billToUnit = ?"]);
    expect(values).toEqual([3]);
  });

  test("does nothing when unit filter is empty", () => {
    const parts = [];
    const values = [];
    appendInvoiceBillToUnitFilterIfSelected({}, parts, values);
    expect(parts).toEqual([]);
    expect(values).toEqual([]);
  });

  test("supports custom inv alias", () => {
    const parts = [];
    const values = [];
    appendInvoiceBillToUnitFilterIfSelected({ unit: "1" }, parts, values, "ri");
    expect(parts).toEqual(["ri.billToUnit = ?"]);
    expect(values).toEqual([1]);
  });
});

describe("appendInvoicesReceivedBillToUnitFilterIfSelected", () => {
  test("adds COALESCE across invoice billToUnit columns when unit filter is set", () => {
    const parts = [];
    const values = [];
    appendInvoicesReceivedBillToUnitFilterIfSelected({ unit: "4" }, parts, values);
    expect(parts).toEqual([
      "COALESCE(ri.billToUnit, si.billToUnit, vi.billToUnit) = ?"
    ]);
    expect(values).toEqual([4]);
  });
});
