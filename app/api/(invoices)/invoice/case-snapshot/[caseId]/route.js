/**
 * GET /api/invoice/case-snapshot/:caseId
 * Read-only NCI row for recovery / SARFAESI / vehicle invoice case snapshot (no unit row scope).
 */

import { cookies } from "next/headers";
import { getSessionUser } from "../../../../../../lib/session";
import {
  canAccessInvoiceLinkedSnapshot,
  loadInvoiceLinkedCaseByCaseId
} from "../../../../../../lib/modules/invoiceCaseSnapshot";
import { jsonApiErrorForAction, jsonUnauthorizedForSession } from "../../../../../../lib/apiErrorResponse";

/**
 * GET /api/invoice/case-snapshot/:caseId — read-only NCI snapshot for invoice Case No pickers.
 */
export async function GET(_req, { params }) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get("session")?.value;
    const user = await getSessionUser(sid);
    if (!user) return await jsonUnauthorizedForSession(sid);

    if (!(await canAccessInvoiceLinkedSnapshot(user))) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { caseId: caseIdRaw } = await params;
    const caseId = Number(caseIdRaw);
    if (!Number.isFinite(caseId) || caseId <= 0) {
      return Response.json({ error: "Record not found" }, { status: 404 });
    }

    const linked = await loadInvoiceLinkedCaseByCaseId(caseId, {
      childKeys: ["amount_recovered"]
    });
    if (!linked?.data) {
      return Response.json({ error: "Record not found" }, { status: 404 });
    }

    return Response.json({
      data: linked.data,
      childTableRows: linked.childTableRows || {}
    });
  } catch (error) {
    return jsonApiErrorForAction(error, "loadInvoiceCaseSnapshot", {
      logLabel: "Invoice case snapshot API"
    });
  }
}
