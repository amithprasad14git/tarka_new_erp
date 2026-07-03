/**
 * Tests for `accountsInFavourOfClient`.
 * Run with: npm test
 */

const { handlePartyInFavourOfAutoFill } = require("../../lib/modules/accountsInFavourOfClient");

describe("handlePartyInFavourOfAutoFill", () => {
  test("fills inFavourOf from selected lookup label", () => {
    const bumpInFavourOfInputKey = jest.fn();
    const setAutoValues = jest.fn((updater) => updater({ unit: "1" }));

    const handled = handlePartyInFavourOfAutoFill(
      "paidTo",
      "paidTo",
      "42",
      setAutoValues,
      bumpInFavourOfInputKey,
      "ABC Traders"
    );

    expect(handled).toBe(true);
    expect(setAutoValues).toHaveBeenCalledTimes(1);
    expect(setAutoValues.mock.results[0].value).toEqual({
      unit: "1",
      inFavourOf: "ABC Traders"
    });
    expect(bumpInFavourOfInputKey).toHaveBeenCalledTimes(1);
  });

  test("clears inFavourOf when selection is removed", () => {
    const bumpInFavourOfInputKey = jest.fn();
    const setAutoValues = jest.fn((updater) => updater({ inFavourOf: "Old Name" }));

    const handled = handlePartyInFavourOfAutoFill(
      "paidTo",
      "paidTo",
      "",
      setAutoValues,
      bumpInFavourOfInputKey,
      ""
    );

    expect(handled).toBe(true);
    expect(setAutoValues.mock.results[0].value).toEqual({ inFavourOf: "" });
    expect(bumpInFavourOfInputKey).toHaveBeenCalledTimes(1);
  });
});
