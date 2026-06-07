import { htmlColumnWidthPercents, parseHtmlColumnWeight } from "../../lib/reports/htmlColumnWidths";

describe("htmlColumnWidths", () => {
  test("parseHtmlColumnWeight reads rem", () => {
    expect(parseHtmlColumnWeight("7rem")).toBe(7);
    expect(parseHtmlColumnWeight("2rem")).toBe(2);
  });

  test("htmlColumnWidthPercents sums to 100%", () => {
    const pcts = htmlColumnWidthPercents([
      { widthHtml: "3rem" },
      { widthHtml: "9rem" }
    ]);
    const sum = pcts.reduce((s, p) => s + parseFloat(p), 0);
    expect(sum).toBeCloseTo(100, 1);
    expect(parseFloat(pcts[0])).toBeLessThan(parseFloat(pcts[1]));
  });

  test("uses default weight when widthHtml missing", () => {
    const pcts = htmlColumnWidthPercents([{}, { widthHtml: "12rem" }]);
    expect(parseFloat(pcts[1])).toBeGreaterThan(parseFloat(pcts[0]));
  });
});
