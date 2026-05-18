const { amountToWordsInr } = require("../../lib/amountInWords");

describe("amountToWordsInr", () => {
  test("15000 matches legacy sample wording", () => {
    expect(amountToWordsInr(15000)).toBe("Fifteen Thousand");
  });

  test("zero returns empty", () => {
    expect(amountToWordsInr(0)).toBe("");
  });

  test("one lakh", () => {
    expect(amountToWordsInr(100000)).toBe("One Lakh");
  });
});
