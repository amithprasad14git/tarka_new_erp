// Application API route — SARFAESI 13(2) Demand Notice covering sheet PDF download.

/**
 * GET /api/sarfaesi-case-status-update/covering-132-pdf/:id
 *
 * Auth → load status update + child particulars → NCI/branch/unit → PDF buffer.
 * Drawing: lib/modules/sarfaesiCaseStatusUpdateCovering132Pdf.js
 * Guide: README.md#sarfaesi-covering-sheet-pdfs
 */

import { requireRequestUser } from "../../../../../../lib/requestSession";
import { getCrudRecordById } from "../../../../../../lib/services/crud.service";
import { queryWithRetry } from "../../../../../../lib/db";
import { rowValueForField } from "../../../../../../lib/gridRowValue";
import { loadInvoiceLinkedCaseByCaseId } from "../../../../../../lib/modules/invoiceCaseSnapshot";
import {
  buildSarfaesiCovering132PdfBuffer,
  safeSarfaesiCovering132PdfFilename
} from "../../../../../../lib/modules/sarfaesiCaseStatusUpdateCovering132Pdf";
import { jsonApiErrorForAction } from "../../../../../../lib/apiErrorResponse";

async function loadBranchChainForPdf(branchId) {
  if (!Number.isFinite(branchId) || branchId <= 0) {
    return { bankName: "", rboName: "", branchDisplay: "", branchPlace: "" };
  }
  const [branchRows] = await queryWithRetry(
    `
    SELECT
      br.branchName,
      br.branchCode,
      br.place AS branchPlace,
      rbo.fullName AS rboFullName,
      rbo.shortCode AS rboShortCode,
      bm.bankName
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
  const branchName = String(rowValueForField(br, "branchName") ?? "").trim();
  const branchCode = String(rowValueForField(br, "branchCode") ?? "").trim();
  const branchDisplay =
    branchName && branchCode ? `${branchName} (${branchCode})` : branchName || branchCode || "";
  const rboName = String(
    rowValueForField(br, "rboFullName") ?? rowValueForField(br, "rboShortCode") ?? ""
  ).trim();
  return {
    bankName: String(rowValueForField(br, "bankName") ?? "").trim(),
    rboName,
    branchDisplay,
    branchPlace: String(rowValueForField(br, "branchPlace") ?? "").trim()
  };
}

/** Person in charge for the case unit (signatory on covering sheet). */
async function loadUnitPersonIncharge(unitId) {
  if (!Number.isFinite(unitId) || unitId <= 0) return "";
  const [rows] = await queryWithRetry(
    `SELECT personIncharge FROM unit_master WHERE id = ? LIMIT 1`,
    [unitId]
  );
  return String(rowValueForField(rows?.[0] || {}, "personIncharge") ?? "").trim();
}

export async function GET(req, { params }) {
  try {
    // --- Login ---
    const auth = await requireRequestUser(req);
    if (auth.unauthorized) return auth.unauthorized;
    const user = auth.user;

    // --- Load status update + child particulars ---
    const { id } = await params;
    const result = await getCrudRecordById(user, "sarfaesi_case_status_update", id);
    if (result.status !== 200) {
      return Response.json(result.body, { status: result.status });
    }

    const statusUpdate = result.body.data;
    const childTableRows = result.body.childTableRows || {};
    const detailRows = childTableRows.sarfaesi_case_status_update_details || [];
    const refNo = String(rowValueForField(statusUpdate, "refNo") ?? "").trim();

    // --- Linked NCI → branch chain + unit person-in-charge ---
    const caseId = Number(rowValueForField(statusUpdate, "caseNo"));
    let nciRow = {};
    let branchContext = { bankName: "", rboName: "", branchDisplay: "", branchPlace: "" };
    let signatoryName = "";

    if (Number.isFinite(caseId) && caseId > 0) {
      const linked = await loadInvoiceLinkedCaseByCaseId(caseId);
      if (linked?.data) {
        nciRow = linked.data;
        const branchId = Number(rowValueForField(nciRow, "branch"));
        branchContext = await loadBranchChainForPdf(branchId);
        const unitId = Number(rowValueForField(nciRow, "unit"));
        signatoryName = await loadUnitPersonIncharge(unitId);
      }
    }

    // --- Build Covering Sheet PDF and return download ---
    const buffer = await buildSarfaesiCovering132PdfBuffer({
      statusUpdate,
      nciRow,
      branchContext,
      signatoryName,
      detailRows
    });

    const filename = safeSarfaesiCovering132PdfFilename(refNo || id);
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (e) {
    return jsonApiErrorForAction(e, "downloadPdf", { logLabel: "sarfaesi covering-132 pdf" });
  }
}
