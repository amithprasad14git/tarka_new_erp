import { branchLabelSelectSql } from "../../lib/reports/reportBranchLabelSql";

describe("branchLabelSelectSql", () => {
  test("uses bank short code, branch name, and branch code", () => {
    const sql = branchLabelSelectSql("br", "bank");
    expect(sql).toBe(
      "CONCAT(bank.bankCode, ' - ', br.branchName, ' (', br.branchCode, ')') AS branchLabel"
    );
  });
});
