/**
 * HTTP handler for `/api/new-case-inward/branch-copy-pdf/[id]`.
 * Business rules live in lib/modules; this file loads data and returns JSON or files.
 */

// Application route/page/API handler for this feature area.
// Keep module-specific business logic in lib/modules/<module> files.

import { cookies } from "next/headers";
import { getSessionUser } from "../../../../../lib/session";
import { getCrudRecordById } from "../../../../../lib/services/crud.service";
import pool from "../../../../../lib/db";
import { rowValueForField } from "../../../../../lib/gridRowValue";
import {
  buildNewCaseInwardBranchCopyPdf,
  safeBranchCopyPdfFilename
} from "../../../../../lib/modules/newCaseInwardBranchCopyPdf";
import { jsonApiErrorForAction } from "../../../../../lib/apiErrorResponse";

/**
 * Session helper for API routes in this file.
 * Returns logged-in user object or null when session is missing/expired.
 */
async function getRequestUser() {
  const cookieStore = await cookies();
  const sid = cookieStore.get("session")?.value;
  return getSessionUser(sid);
}

/**
 * GET /api/new-case-inward/branch-copy-pdf/:id
 *
 * Layman flow:
 * 1) Verify user session.
 * 2) Load target NCI row using existing CRUD permission/scope checks.
 * 3) Load bank/branch/unit context needed by the Branch Copy layout.
 * 4) Build PDF buffer and return it as a downloadable file.
 */
// Branch Copy PDF for one NCI case (bank letter to branch).
export async function GET(_req, { params }) {
  try {
    const user = await getRequestUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const result = await getCrudRecordById(user, "new_case_inward", id);
    if (result.status !== 200) {
      return Response.json(result.body, { status: result.status });
    }

    const { data } = result.body;
    // Parent record stores branch and unit references; resolve labels/details below.
    const branchId = Number(rowValueForField(data, "branch"));
    const unitId = Number(rowValueForField(data, "unit"));

    let bankName = "";
    let bankShortCode = "";
    let branchName = "";
    let branchCode = "";
    let place = "";
    let rboName = "";
    let signatoryName = "";
    let unitCode = "";

    const conn = await pool.getConnection();
    try {
      if (Number.isFinite(branchId)) {
        // Resolve hierarchy (Branch -> RBO/RO -> HO/ZO -> Bank) for PDF header lines.
        const [branchRows] = await conn.query(
          `
          SELECT
            br.branchName,
            br.branchCode,
            br.place,
            rbo.fullName AS rboFullName,
            rbo.shortCode AS rboShortCode,
            bm.bankName,
            bm.bankCode
          FROM branch_master br
          INNER JOIN rbo_master rbo ON rbo.id = br.rbo_ro
          INNER JOIN ho_zo_master hz ON hz.id = rbo.ho_zo
          INNER JOIN bank_master bm ON bm.id = hz.bank
          WHERE br.id = ?
          LIMIT 1
          `,
          [branchId]
        );
        const br = branchRows?.[0] || {};
        bankName = String(rowValueForField(br, "bankName") ?? "").trim();
        bankShortCode = String(rowValueForField(br, "bankCode") ?? "").trim();
        branchName = String(rowValueForField(br, "branchName") ?? "").trim();
        branchCode = String(rowValueForField(br, "branchCode") ?? "").trim();
        place = String(rowValueForField(br, "place") ?? "").trim();
        rboName = String(
          rowValueForField(br, "rboFullName") ?? rowValueForField(br, "rboShortCode") ?? ""
        ).trim();
      }

      if (Number.isFinite(unitId)) {
        // Unit holds person-in-charge and unit code used for signature logic.
        const [unitRows] = await conn.query(
          `SELECT personIncharge, unitCode FROM unit_master WHERE id = ? LIMIT 1`,
          [unitId]
        );
        signatoryName = String(rowValueForField(unitRows?.[0] || {}, "personIncharge") ?? "").trim();
        unitCode = String(rowValueForField(unitRows?.[0] || {}, "unitCode") ?? "").trim();
      }
    } finally {
      conn.release();
    }

    const branchLabel =
      branchName && branchCode ? `${branchName} (${branchCode})` : branchName || branchCode || "";

    // Dedicated Branch Copy PDF (separate from Case Details PDF flow).
    const pdfBuffer = await buildNewCaseInwardBranchCopyPdf({
      data,
      bankName,
      bankShortCode,
      branchLabel,
      place,
      rboName,
      signatoryName,
      unitLabel: String(rowValueForField(data, "unitLabel") ?? rowValueForField(data, "unit") ?? "").trim(),
      unitCode
    });
    const filename = safeBranchCopyPdfFilename(rowValueForField(data, "caseNo"));

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    return jsonApiErrorForAction(error, "downloadPdf", { logLabel: "Branch copy PDF" });
  }
}

