/**
 * Tests for `postCreateAck` helpers.
 * Run with: npm test
 */

const {
  buildPostCreateAckUpdateBody,
  resolvePostCreateAckModalCopy
} = require("../../lib/postCreateAck");

describe("resolvePostCreateAckModalCopy", () => {
  const ackCfg = {
    title: "Recovery Invoice Generated",
    hint: "Note this number for your reference before continuing.",
    editTitle: "Recovery Invoice saved",
    editHint: "Your invoice number is shown below. Continue or print."
  };

  test("uses create copy on new entry", () => {
    expect(resolvePostCreateAckModalCopy(ackCfg, false)).toEqual({
      title: "Recovery Invoice Generated",
      hint: "Note this number for your reference before continuing."
    });
  });

  test("uses edit copy on update", () => {
    expect(resolvePostCreateAckModalCopy(ackCfg, true)).toEqual({
      title: "Recovery Invoice saved",
      hint: "Your invoice number is shown below. Continue or print."
    });
  });

  test("falls back to title and hint when edit overrides omitted", () => {
    expect(
      resolvePostCreateAckModalCopy(
        { title: "Return Case saved", hint: "Your reference number is shown below." },
        true
      )
    ).toEqual({
      title: "Return Case saved",
      hint: "Your reference number is shown below."
    });
  });
});

describe("buildPostCreateAckUpdateBody", () => {
  test("includes postCreateAck when field has value", () => {
    const body = buildPostCreateAckUpdateBody(
      { postCreateAck: { field: "refNo" } },
      7,
      { refNo: "RC/FY26/0001" }
    );
    expect(body).toEqual({
      ok: true,
      id: 7,
      postCreateAck: { field: "refNo", value: "RC/FY26/0001" }
    });
  });

  test("omits postCreateAck when field is empty", () => {
    const body = buildPostCreateAckUpdateBody(
      { postCreateAck: { field: "refNo" } },
      7,
      { refNo: "" }
    );
    expect(body).toEqual({ ok: true, id: 7 });
  });
});
