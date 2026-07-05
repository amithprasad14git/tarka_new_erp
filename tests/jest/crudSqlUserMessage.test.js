/** @jest-environment node */

const {
  isCrudValidationErrorCode,
  userMessageFromSqlError,
  resolveCrudWriteErrorResponse
} = require("../../lib/crudSqlUserMessage");
const { apiUserMessage } = require("../../lib/apiUserMessages");

describe("crudSqlUserMessage", () => {
  test("isCrudValidationErrorCode recognizes module validation codes", () => {
    expect(isCrudValidationErrorCode("RECOVERY_INVOICE_VALIDATION_FAILED")).toBe(true);
    expect(isCrudValidationErrorCode("CHILD_ROWS_INVALID")).toBe(true);
    expect(isCrudValidationErrorCode("ER_BAD_NULL_ERROR")).toBe(false);
  });

  test("userMessageFromSqlError maps ER_BAD_NULL_ERROR with column name", () => {
    const err = Object.assign(new Error("Column 'caseNo' cannot be null"), {
      code: "ER_BAD_NULL_ERROR",
      sqlMessage: "Column 'caseNo' cannot be null"
    });
    expect(userMessageFromSqlError(err)).toEqual({
      status: 400,
      error: "Case No is required."
    });
  });

  test("userMessageFromSqlError maps ER_NO_REFERENCED_ROW_2", () => {
    const err = Object.assign(new Error("fk fail"), { code: "ER_NO_REFERENCED_ROW_2" });
    expect(userMessageFromSqlError(err).status).toBe(400);
    expect(userMessageFromSqlError(err).error).toMatch(/lookup value is invalid/i);
  });

  test("userMessageFromSqlError maps ER_DUP_ENTRY", () => {
    const err = Object.assign(new Error("dup"), { code: "ER_DUP_ENTRY" });
    expect(userMessageFromSqlError(err)).toEqual({
      status: 400,
      error: "This record already exists."
    });
  });

  test("userMessageFromSqlError falls back to saveRecord for unknown errors", () => {
    const err = new Error("insert failed");
    expect(userMessageFromSqlError(err)).toEqual({
      status: 500,
      error: apiUserMessage("saveRecord")
    });
  });

  test("resolveCrudWriteErrorResponse returns validation message as 400", () => {
    const err = Object.assign(new Error("Bill to Unit is required."), {
      code: "RECOVERY_INVOICE_VALIDATION_FAILED"
    });
    expect(resolveCrudWriteErrorResponse(err)).toEqual({
      status: 400,
      body: { error: "Bill to Unit is required." }
    });
  });
});
