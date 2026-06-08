/**
 * Tests for lib/apiErrorResponse.js
 */

const {
  isDbOrNetworkError,
  jsonApiError,
  jsonApiErrorForAction,
  laymanMessageForError
} = require("../../lib/apiErrorResponse");
const { apiUserMessage } = require("../../lib/apiUserMessages");

describe("apiErrorResponse", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("jsonApiError includes hint for DB connection errors", async () => {
    const err = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    const res = jsonApiError(err, { laymanMessage: apiUserMessage("loadList") });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe(apiUserMessage("loadList"));
    expect(body.hint).toContain("connection refused");
  });

  test("jsonApiError omits hint when error is not DB-related", async () => {
    const res = jsonApiError(new Error("unexpected"), {
      laymanMessage: apiUserMessage("genericServer")
    });
    const body = await res.json();
    expect(body).toEqual({ error: apiUserMessage("genericServer") });
  });

  test("laymanMessageForError uses Db variant for connectivity errors", () => {
    const err = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    expect(laymanMessageForError("saveRecord", err)).toBe(apiUserMessage("saveRecordDb"));
    expect(laymanMessageForError("saveRecord", new Error("other"))).toBe(apiUserMessage("saveRecord"));
  });

  test("isDbOrNetworkError reflects getDbErrorHint", () => {
    const err = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    expect(isDbOrNetworkError(err)).toBe(true);
    expect(isDbOrNetworkError(new Error("validation"))).toBe(false);
  });

  test("jsonApiErrorForAction picks message key and status", async () => {
    const err = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    const res = jsonApiErrorForAction(err, "deleteRecord", { status: 500, logLabel: "DELETE test" });
    const body = await res.json();
    expect(body.error).toBe(apiUserMessage("deleteRecordDb"));
    expect(body.hint).toBeTruthy();
    expect(consoleErrorSpy).toHaveBeenCalledWith("DELETE test:", expect.any(Object));
  });
});
