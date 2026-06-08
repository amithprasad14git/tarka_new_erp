/**
 * Tests for lib/fetchClientError.js
 */

const {
  formatApiErrorPayload,
  formatUserFacingError,
  isNetworkFetchError,
  isUnauthorizedMessage,
  readJsonResponse
} = require("../../lib/fetchClientError");
const { apiUserMessage } = require("../../lib/apiUserMessages");

describe("fetchClientError", () => {
  test("formatApiErrorPayload joins error and hint", () => {
    expect(
      formatApiErrorPayload(
        { error: "We could not save.", hint: "Check DB_HOST." },
        "fallback"
      )
    ).toBe("We could not save. Check DB_HOST.");
  });

  test("formatApiErrorPayload uses fallback when error missing", () => {
    expect(formatApiErrorPayload(null, apiUserMessage("loadList"))).toBe(
      apiUserMessage("loadList")
    );
  });

  test("formatUserFacingError maps Failed to fetch to network message", () => {
    const err = new TypeError("Failed to fetch");
    expect(formatUserFacingError(err)).toBe(apiUserMessage("networkUnreachable"));
    expect(isNetworkFetchError(err)).toBe(true);
  });

  test("formatUserFacingError maps Unauthorized to session expired", () => {
    expect(formatUserFacingError(new Error("Unauthorized"))).toBe(
      apiUserMessage("sessionExpired")
    );
    expect(isUnauthorizedMessage("Unauthorized")).toBe(true);
  });

  test("formatUserFacingError preserves API error text", () => {
    expect(
      formatUserFacingError(new Error("We could not save. Check DB_HOST."), {
        fallback: apiUserMessage("saveRecord")
      })
    ).toBe("We could not save. Check DB_HOST.");
  });

  test("readJsonResponse parses JSON and tolerates empty body", async () => {
    const res = new Response('{"ok":true}', { status: 200 });
    await expect(readJsonResponse(res)).resolves.toEqual({ ok: true });
    const empty = new Response(null, { status: 204 });
    await expect(readJsonResponse(empty)).resolves.toBeNull();
  });
});
