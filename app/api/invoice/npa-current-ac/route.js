/**
 * GET /api/invoice/npa-current-ac?caseId={nciId}
 * Shared NPA Current AC auto-fill for recovery, SARFAESI, and vehicle invoice entry forms.
 */

import { cookies } from "next/headers";
import pool from "../../../../lib/db";
import { hasModulePermission } from "../../../../lib/rbac";
import { getSessionUser } from "../../../../lib/session";
import {
  canAccessAnyInvoiceModule,
  resolveInvoiceNpaCurrentAcByCaseId
} from "../../../../lib/modules/invoiceNpaCurrentAc";
import { jsonApiErrorForAction } from "../../../../lib/apiErrorResponse";

export async function GET(req) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get("session")?.value;
    const user = await getSessionUser(sid);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!(await canAccessAnyInvoiceModule(user))) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const caseId = Number(url.searchParams.get("caseId"));
    if (!Number.isFinite(caseId) || caseId <= 0) {
      return Response.json({
        npaCurrentAc: "",
        npaCurrentAcLabel: "",
        billToUnit: "",
        billToUnitLabel: ""
      });
    }

    const conn = await pool.getConnection();
    try {
      const result = await resolveInvoiceNpaCurrentAcByCaseId(conn, caseId);
      return Response.json(result);
    } finally {
      conn.release();
    }
  } catch (error) {
    return jsonApiErrorForAction(error, "loadInvoiceNpaCurrentAc", {
      logLabel: "Invoice NPA Current AC API"
    });
  }
}
