// Application API route — branch search for Search Bank & Branch dashboard.

/**
 * GET /api/dashboard/search-bank-branch/search?q=
 * Typeahead endpoint for SearchBankBranchWidget. Requires dashboard_search_bank_branch permission.
 * Delegates matching to lib/dashboards/search_bank_branch/searchBranches.js.
 */

import { requireRequestUser } from "../../../../../../lib/requestSession";
import { canAccessDashboard } from "../../../../../../lib/dashboards/dashboardAccess";
import { searchBranches } from "../../../../../../lib/dashboards/search_bank_branch/searchBranches";
import { jsonApiErrorForAction } from "../../../../../../lib/apiErrorResponse";

/** Search branches by code/name fragment; returns rows + truncated flag. */
export async function GET(req) {
  try {
    const auth = await requireRequestUser(req);
    if (auth.unauthorized) return auth.unauthorized;
    const user = auth.user;

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

