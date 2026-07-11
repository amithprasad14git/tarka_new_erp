// Application route/page/API handler for this feature area.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * GET `/api/new-case-inward/case-details-pdf/:id` — PDF download (parent + child tables).
 * Same access rules as GET `/api/crud/new_case_inward/:id`.
 *
 * Plain-language flow:
 * 1) Check login/session
 * 2) Load one New Case Inward record (with child rows) through CRUD service
 * 3) Resolve bank + RBO from selected branch for report header lines
 * 4) Build PDF bytes
 * 5) Return as file download
 */
import { requireRequestUser } from "../../../../../../lib/requestSession";
import pool from "../../../../../../lib/db";
import { resolveNewCaseInwardBankRuleByBranch } from "../../../../../../lib/modules/newCaseInward";
import { getCrudRecordById } from "../../../../../../lib/services/crud.service";
import {
  buildNewCaseInwardCaseDetailsPdf,
  safeCaseDetailsPdfFilename
} from "../../../../../../lib/modules/newCaseInwardCaseDetailsPdf";
import { rowValueForField } from "../../../../../../lib/gridRowValue";
import { jsonApiErrorForAction } from "../../../../../../lib/apiErrorResponse";
import { apiUserMessage } from "../../../../../../lib/apiUserMessages";

/**
 * GET /api/new-case-inward/case-details-pdf/:id — download Case Details PDF for one NCI row.
 */
// Full case dossier PDF (parent + child tables); same access as viewing the NCI record.
export async function GET(req, { params }) {
  try {
    const auth = await requireRequestUser(req);
    if (auth.unauthorized) return auth.unauthorized;
    const user = auth.user;

    const { id } = await params;
    const result = await getCrudRecordById(user, "new_case_inward", id);
    if (result.status !== 200) {
      return Response.json(result.body, { status: result.status });
    }

    const { data, childTableRows } = result.body;
    // Resolve bank and RBO names for PDF header from branch hierarchy.
    let bankName = "";
    let rboName = "";
    const branchId = Number(rowValueForField(data, "branch"));
    if (Number.isFinite(branchId)) {
      const conn = await pool.getConnection();
      try {
        const rule = await resolveNewCaseInwardBankRuleByBranch(conn, branchId);
        bankName = String(rule?.bankName ?? "").trim();
        const [rows] = await conn.query(
          `
          SELECT rbo.*
          FROM branch_master br
          INNER JOIN rbo_master rbo ON rbo.id = br.rbo_ro
          WHERE br.id = ?
          LIMIT 1
          `,
          [branchId]
        );
        const r = rows?.[0] || {};
        rboName = String(
          rowValueForField(r, "shortCode") ??
            rowValueForField(r, "short_code") ??
            rowValueForField(r, "rbo_ro") ??
            rowValueForField(r, "name") ??
            ""
        ).trim();
      } finally {
        conn.release();
      }
    }
    // Build final PDF with parent + child details + header context values.
    const pdfBuffer = await buildNewCaseInwardCaseDetailsPdf({
      data,
      childTableRows,
      bankName,
      rboName
    });
    const caseSeg = safeCaseDetailsPdfFilename(rowValueForField(data, "caseNo"));
    const filename = `CASE_DETAILS_${caseSeg}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    const msg = String(error?.message || error || "");
    const missingMod =
      msg.includes("Cannot find module") ||
      msg.includes("MODULE_NOT_FOUND") ||
      error?.code === "MODULE_NOT_FOUND";
    if (missingMod) {
      return Response.json({ error: apiUserMessage("pdfLibraryMissing") }, { status: 500 });
    }
    return jsonApiErrorForAction(error, "downloadPdf", { logLabel: "Case details PDF" });
  }
}


