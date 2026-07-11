// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `amountInWords`.
 * Run with: npm test
 */

const { amountToWordsInr } = require("../../lib/amountInWords");

// Checks money amounts convert to the correct words for invoices and letters.
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


