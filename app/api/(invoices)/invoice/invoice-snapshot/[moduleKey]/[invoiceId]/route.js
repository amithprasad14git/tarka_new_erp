/**
 * GET /api/invoice/invoice-snapshot/:moduleKey/:invoiceId
 * Read-only invoice row for Invoices Received snapshot (no row scope).
 */

import { cookies } from "next/headers";
import pool from "../../../../../../../lib/db";
import { getSessionUser } from "../../../../../../../lib/session";
import {
  canAccessInvoiceLinkedSnapshot,
  INVOICE_ROW_SNAPSHOT_MODULE_KEYS,
  loadInvoiceRowForSnapshotById
} from "../../../../../../../lib/modules/invoiceCaseSnapshot";
import { jsonApiErrorForAction, jsonUnauthorizedForSession } from "../../../../../../../lib/apiErrorResponse";

/**
 * GET /api/invoice/invoice-snapshot/:moduleKey/:invoiceId — read-only invoice header for Invoices Received.
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

    const { moduleKey, invoiceId: invoiceIdRaw } = await params;
    if (!INVOICE_ROW_SNAPSHOT_MODULE_KEYS.includes(moduleKey)) {
      return Response.json({ error: "Unknown module" }, { status: 404 });
    }

    const invoiceId = Number(invoiceIdRaw);
    if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
      return Response.json({ error: "Record not found" }, { status: 404 });
    }

    const conn = await pool.getConnection();
    try {
      const data = await loadInvoiceRowForSnapshotById(conn, moduleKey, invoiceId);
      if (!data) {
        return Response.json({ error: "Record not found" }, { status: 404 });
      }
      return Response.json({ data });
    } finally {
      conn.release();
    }
  } catch (error) {
    return jsonApiErrorForAction(error, "loadInvoiceRowSnapshot", {
      logLabel: "Invoice row snapshot API"
    });
  }
}
