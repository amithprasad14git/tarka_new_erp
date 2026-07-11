// Shared SQL fragment — branch display label for case/ledger reports.

/**
 * Legacy-style branch label: `SBI - Palahally (040404)`
 * = bank short code + branch name + branch code in parentheses.
 *
 * @param {string} [brAlias]
 * @param {string} [bankAlias]
 * @returns {string}
 */
export function branchLabelSelectSql(brAlias = "br", bankAlias = "bank") {
  return `CONCAT(${bankAlias}.bankCode, ' - ', ${brAlias}.branchName, ' (', ${brAlias}.branchCode, ')') AS branchLabel`;
}

