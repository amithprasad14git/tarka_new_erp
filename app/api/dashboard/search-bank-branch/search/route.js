// Application API route — branch search for Search Bank & Branch dashboard.

/**
 * GET /api/dashboard/search-bank-branch/search?q=
 * Typeahead endpoint for SearchBankBranchWidget. Requires dashboard_search_bank_branch permission.
 * Delegates matching to lib/dashboards/search_bank_branch/searchBranches.js.
 */

import { cookies } from "next/headers";
import { getSessionUser } from "../../../../../lib/session";
import { canAccessDashboard } from "../../../../../lib/dashboards/dashboardAccess";
import { searchBranches } from "../../../../../lib/dashboards/search_bank_branch/searchBranches";
import { jsonApiErrorForAction } from "../../../../../lib/apiErrorResponse";

/** Read logged-in user from session cookie (shared by GET handler). */
async function getRequestUser() {
  const cookieStore = await cookies();
  const sid = cookieStore.get("session")?.value;
  return getSessionUser(sid);
}

/** Search branches by code/name fragment; returns rows + truncated flag. */
export async function GET(req) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await canAccessDashboard(user, "search_bank_branch");
    if (!allowed) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";
    const result = await searchBranches(q);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json(
      {
        rows: result.rows,
        truncated: result.truncated
      },
      { status: 200 }
    );
  } catch (error) {
    return jsonApiErrorForAction(error, "searchBankBranch", { logLabel: "Search bank branch GET" });
  }
}
