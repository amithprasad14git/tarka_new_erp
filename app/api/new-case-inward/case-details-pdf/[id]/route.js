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
import { cookies } from "next/headers";
import { getSessionUser } from "../../../../../lib/session";
import pool from "../../../../../lib/db";
import { resolveNewCaseInwardBankRuleByBranch } from "../../../../../lib/modules/newCaseInward";
import { getCrudRecordById } from "../../../../../lib/services/crud.service";
import {
  buildNewCaseInwardCaseDetailsPdf,
  safeCaseDetailsPdfFilename
} from "../../../../../lib/modules/newCaseInwardCaseDetailsPdf";
import { rowValueForField } from "../../../../../lib/gridRowValue";

async function getRequestUser() {
  // Reuse session cookie handling used by other APIs.
  const cookieStore = await cookies();
  const sid = cookieStore.get("session")?.value;
  return getSessionUser(sid);
}

export async function GET(req, { params }) {
  try {
    const user = await getRequestUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const result = await getCrudRecordById(user, "new_case_inward", id);
    if (result.status !== 200) {
      return Response.json(result.body, { status: result.status });
    }

    const { data, childTableRows } = result.body;
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
    console.error("Case details PDF error:", error);
    const msg = String(error?.message || error || "");
    const missingMod =
      msg.includes("Cannot find module") ||
      msg.includes("MODULE_NOT_FOUND") ||
      error?.code === "MODULE_NOT_FOUND";
    return Response.json(
      {
        error: missingMod ? "PDF library not installed. Run npm install in the project folder." : "Failed to generate PDF"
      },
      { status: 500 }
    );
  }
}
