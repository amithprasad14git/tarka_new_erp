// Application API route — Return Case letter PDF download.

/**
 * Return Case PDF API
 *
 * GET /api/return-case/pdf/:id
 *
 * What this does (in plain terms):
 * 1. Checks the user is logged in.
 * 2. Loads the saved Return Case and its child “return reasons” rows.
 * 3. Loads the linked New Case Inward (borrower, loan, branch, unit).
 * 4. Builds the 3-page letter PDF and sends it as a download (RETURN_<refNo>.pdf).
 *
 * Called from the browser when staff click Print on a Return Case.
 * Drawing logic lives in lib/modules/returnCasePdf.js — see README.md#return-case-letter-pdf.
 */

import { requireRequestUser } from "../../../../../../lib/requestSession";
import { getCrudRecordById } from "../../../../../../lib/services/crud.service";
import { queryWithRetry } from "../../../../../../lib/db";
import { rowValueForField } from "../../../../../../lib/gridRowValue";
import {
  buildReturnCasePdfBuffer,
  filterSelectedReturnCaseDetails,
  safeReturnCasePdfFilename
} from "../../../../../../lib/modules/returnCasePdf";
import { jsonApiErrorForAction } from "../../../../../../lib/apiErrorResponse";

/**
 * Load bank name, branch display text, and RBO name for the PDF header.
 * Follows branch → RBO → HO/ZO → bank in master tables.
 */
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
    rowValueForField(br, "rboShortCode") ?? rowValueForField(br, "rboFullName") ?? ""
  ).trim();
  return {
    bankName: String(rowValueForField(br, "bankName") ?? "").trim(),
    rboName,
    branchDisplay,
    branchPlace: String(rowValueForField(br, "branchPlace") ?? "").trim()
  };
}

/** Load unit code (shown in PDF header) from unit_master. */
async function loadUnitShortCode(unitId) {
  if (!Number.isFinite(unitId) || unitId <= 0) return "";
  const [rows] = await queryWithRetry(`SELECT unitCode FROM unit_master WHERE id = ? LIMIT 1`, [unitId]);
  return String(rowValueForField(rows?.[0] || {}, "unitCode") ?? "").trim();
}

/**
 * GET /api/return-case/pdf/:id — download Return Case triplicate PDF.
 */
// Return Case letter PDF (3 pages) for staff Print action.
export async function GET(req, { params }) {
  try {
    const auth = await requireRequestUser(req);
    if (auth.unauthorized) return auth.unauthorized;
    const user = auth.user;

    const { id } = await params;

    // Load Return Case parent + child rows (reasons grid).
    const result = await getCrudRecordById(user, "return_case", id);
    if (result.status !== 200) {
      return Response.json(result.body, { status: result.status });
    }

    const returnCase = result.body.data;
    const childTableRows = result.body.childTableRows || {};
    const returnCaseDetails = filterSelectedReturnCaseDetails(childTableRows.return_case_details || []);
    const refNo = String(rowValueForField(returnCase, "refNo") ?? "").trim();

    // Load linked New Case Inward for borrower / loan / branch / unit.
    const caseId = Number(rowValueForField(returnCase, "caseNo"));
    let nciRow = null;
    let branchContext = { bankName: "", rboName: "", branchDisplay: "", branchPlace: "" };
    let unitShortCode = "";

    if (Number.isFinite(caseId) && caseId > 0) {
      const nciRes = await getCrudRecordById(user, "new_case_inward", caseId);
      if (nciRes.status === 200 && nciRes.body?.data) {
        nciRow = nciRes.body.data;
        const branchId = Number(rowValueForField(nciRow, "branch"));
        branchContext = await loadBranchChainForPdf(branchId);
        const unitId = Number(rowValueForField(nciRow, "unit"));
        unitShortCode = await loadUnitShortCode(unitId);
      }
    }

    // If NCI is missing, still build a PDF with whatever labels we have on the Return Case.
    if (!nciRow) {
      nciRow = {
        caseNo: String(rowValueForField(returnCase, "caseNoLabel") ?? "").trim() || String(caseId || ""),
        borrower: "",
        loanAccountNo: "",
        loanCategoryLabel: "",
        loanTypeLabel: "",
        npaStatusLabel: "",
        closureBalance: "",
        entrustmentDate: ""
      };
    }

    // Build PDF and return as file download.
    const buffer = await buildReturnCasePdfBuffer({
      returnCase,
      nciRow,
      branchContext,
      unitShortCode,
      returnCaseDetails,
      borrowerLatestDetails: rowValueForField(returnCase, "borrowerLatestDetails"),
      ccTo: rowValueForField(returnCase, "ccTo")
    });

    const filename = safeReturnCasePdfFilename(refNo || id);
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (e) {
    return jsonApiErrorForAction(e, "downloadPdf", { logLabel: "return-case pdf" });
  }
}

