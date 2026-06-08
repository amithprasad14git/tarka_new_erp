/**
 * Tests for lib/modules/users.js
 */

jest.mock("../../config/modules", () => ({
  modules: {
    users: { table: "users" }
  }
}));

jest.mock("../../lib/sqlModuleTable", () => ({
  escapeSqlTableId: jest.fn(() => "`users`")
}));

const { applyUsersBeforeWrite } = require("../../lib/modules/users");

describe("users module validation", () => {
  let conn;

  beforeEach(() => {
    conn = { query: jest.fn().mockResolvedValue([[]]) };
  });

  test("trims username and rejects empty", async () => {
    const merged = { username: "   " };
    await expect(applyUsersBeforeWrite(conn, { merged, oldRow: null })).rejects.toMatchObject({
      message: "Username is required.",
      code: "USERS_VALIDATION_FAILED"
    });
  });

  test("rejects duplicate username on create", async () => {
    conn.query.mockResolvedValueOnce([[{ id: 9 }]]);
    const merged = { username: "john" };
    await expect(applyUsersBeforeWrite(conn, { merged, oldRow: null })).rejects.toMatchObject({
      message: "Username is already in use.",
      code: "USERS_VALIDATION_FAILED"
    });
    expect(conn.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE `username` = ?"),
      ["john", 0]
    );
  });

  test("allows same username when updating same row", async () => {
    const merged = { username: "  john  " };
    await expect(
      applyUsersBeforeWrite(conn, { merged, oldRow: { id: 5, username: "john" }, recordId: 5 })
    ).resolves.toBeUndefined();
    expect(merged.username).toBe("john");
    expect(conn.query).toHaveBeenCalledWith(expect.any(String), ["john", 5]);
  });

  test("duplicate check is case-sensitive", async () => {
    conn.query.mockResolvedValueOnce([[]]);
    const merged = { username: "John" };
    await expect(applyUsersBeforeWrite(conn, { merged, oldRow: null })).resolves.toBeUndefined();
    expect(conn.query).toHaveBeenCalledWith(expect.any(String), ["John", 0]);
  });
});
