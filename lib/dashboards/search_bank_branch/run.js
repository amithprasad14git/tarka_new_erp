// Dashboard — Search Bank & Branch landing widget server loader.

/**
 * Initial payload only (empty rows + hint). Live search uses separate search API route.
 * UI: components/dashboards/search_bank_branch/SearchBankBranchWidget.js
 */

/**
 * Initial empty payload for Search Bank & Branch (search runs via separate API).
 * @param {object} user
 * @returns {Promise<{ ok: boolean, data?: object, error?: string, status?: number }>}
 */
export async function loadDashboard(user) {
  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return {
    ok: true,
    data: {
      rows: [],
      hint: "Enter branch code or name to search"
    }
  };
}

