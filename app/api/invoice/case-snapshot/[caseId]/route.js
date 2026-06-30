/**
 * GET /api/invoice/case-snapshot/:caseId
 * Read-only NCI row for recovery / SARFAESI / vehicle invoice case snapshot (no unit row scope).
 */

import { cookies } from "next/headers";
import pool from "../../../../../lib/db";
import { getSessionUser } from "../../../../../lib/session";
import { canAccessInvoiceLinkedSnapshot } from "../../../../../lib/modules/invoiceCaseSnapshot";
import { loadInvoiceCaseSnapshotByCaseId } from "../../../../../lib/modules/invoiceCaseSnapshot";
import { jsonApiErrorForAction } from "../../../../../lib/apiErrorResponse";

export async function GET(_req, { params }) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get("session")?.value;
    const user = await getSessionUser(sid);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!(await canAccessInvoiceLinkedSnapshot(user))) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { caseId: caseIdRaw } = await params;
    const caseId = Number(caseIdRaw);
    if (!Number.isFinite(caseId) || caseId <= 0) {
      return Response.json({ error: "Record not found" }, { status: 404 });
    }

    const conn = await pool.getConnection();
    try {
      const data = await loadInvoiceCaseSnapshotByCaseId(conn, caseId);
      if (!data) {
        return Response.json({ error: "Record not found" }, { status: 404 });
      }
      return Response.json({ data });
    } finally {
      conn.release();
    }
  } catch (error) {
    return jsonApiErrorForAction(error, "loadInvoiceCaseSnapshot", {
      logLabel: "Invoice case snapshot API"
    });
  }
}
