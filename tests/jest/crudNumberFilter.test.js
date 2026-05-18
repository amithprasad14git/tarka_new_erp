import { appendNumberColumnFilter, shouldUseExactNumberColumnFilter } from "../../lib/crudNumberFilter";

describe("crudNumberFilter", () => {
  test("amount fields use partial digit match on stored value", () => {
    const whereParts = [];
    const whereValues = [];
    appendNumberColumnFilter("grandTotal", { type: "number", name: "grandTotal" }, "100", whereParts, whereValues);
    expect(whereParts[0]).toBe("CAST(`grandTotal` AS CHAR) LIKE ? ESCAPE '\\\\'");
    expect(whereValues[0]).toBe("%100%");
  });

  test("strips commas before partial match", () => {
    const whereParts = [];
    const whereValues = [];
    appendNumberColumnFilter("grandTotal", { type: "number", name: "grandTotal" }, "5,000", whereParts, whereValues);
    expect(whereValues[0]).toBe("%5000%");
  });

  test("role uses exact numeric match", () => {
    const whereParts = [];
    const whereValues = [];
    appendNumberColumnFilter("role", { type: "number", name: "role" }, "2", whereParts, whereValues);
    expect(whereParts[0]).toBe("`role` = ?");
    expect(whereValues[0]).toBe(2);
  });

  test("integerOnly uses exact truncated match", () => {
    expect(shouldUseExactNumberColumnFilter({ type: "number", integerOnly: true })).toBe(true);
  });
});
