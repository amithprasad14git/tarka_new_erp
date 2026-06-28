/**
 * GET /api/invoice/npa-current-ac?caseId={nciId}
 * Shared NPA Current AC auto-fill for recovery, SARFAESI, and vehicle invoice entry forms.
 */

import { cookies } from "next/headers";
import pool from "../../../../lib/db";
import { hasModulePermission } from "../../../../lib/rbac";
import { getSessionUser } from "../../../../lib/session";
import {
  INVOICE_MODULE_KEYS_WITH_NPA_AUTO_FILL,
  resolveInvoiceNpaCurrentAcByCaseId
} from "../../../../lib/modules/invoiceNpaCurrentAc";
import { jsonApiErrorForAction } from "../../../../lib/apiErrorResponse";

async function canAccessAnyInvoiceModule(user) {
  for (const moduleKey of INVOICE_MODULE_KEYS_WITH_NPA_AUTO_FILL) {
    const [canView, canCreate, canEdit] = await Promise.all([
      hasModulePermission(user, moduleKey, "view"),
      hasModulePermission(user, moduleKey, "create"),
      hasModulePermission(user, moduleKey, "edit")
    ]);
    if (canView || canCreate || canEdit) return true;
  }
  return false;
}

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
      return Response.json({ npaCurrentAc: "", npaCurrentAcLabel: "" });
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
