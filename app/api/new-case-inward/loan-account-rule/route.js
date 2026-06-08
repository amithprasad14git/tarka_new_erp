/**
 * HTTP handler for `/api/new-case-inward/loan-account-rule`.
 * Business rules live in lib/modules; this file loads data and returns JSON or files.
 */

// Application route/page/API handler for this feature area.
// Keep module-specific business logic in lib/modules/<module> files.

import { cookies } from "next/headers";
import pool from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/session";
import { resolveNewCaseInwardBankRuleByBranch } from "../../../../lib/modules/newCaseInward";
import { jsonApiErrorForAction } from "../../../../lib/apiErrorResponse";

/** Returns bank-specific Loan Account No length rule by selected Branch. */
// Tell the NCI form how many digits Loan Account No must have for the selected branch’s bank.
export async function GET(req) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get("session")?.value;
    const user = await getSessionUser(sid);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const branchId = Number(url.searchParams.get("branchId"));
    if (!Number.isFinite(branchId)) {
      return Response.json({ bankId: null, bankName: "", loanAccountNoLength: null });
    }

    // Branch → bank master rule (length validation on client).
    const conn = await pool.getConnection();
    try {
      const rule = await resolveNewCaseInwardBankRuleByBranch(conn, branchId);
      return Response.json(
        rule || { bankId: null, bankName: "", loanAccountNoLength: null }
      );
    } finally {
      conn.release();
    }
  } catch (error) {
    return jsonApiErrorForAction(error, "loadLoanAccountRule", { logLabel: "Loan account rule API" });
  }
}

