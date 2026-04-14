import { cookies } from "next/headers";
import pool from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/session";
import { resolveNewCaseInwardBankRuleByBranch } from "../../../../lib/modules/newCaseInward";

/** Returns bank-specific Loan Account No length rule by selected Branch. */
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
    console.error("Loan account rule API error:", error);
    return Response.json({ error: "Failed to load loan account rule" }, { status: 500 });
  }
}
