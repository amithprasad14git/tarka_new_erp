// Application API route — Recovery Invoice PDF download.

/**
 * GET /api/recovery-invoice/pdf/:id — 3-page Recovery Invoice PDF download.
 *
 * Loads: recovery_invoice + recovery_charges, case amount_recovered rows, NCI, branch, unit, current account.
 * Drawing: lib/modules/recoveryInvoicePdf.js (frozen layout) — README.md#recovery-invoice-pdf, README.md#invoice--letter-pdfs.
 */

import { requireRequestUser } from "../../../../../../lib/requestSession";
import { getCrudRecordById } from "../../../../../../lib/services/crud.service";
import { queryWithRetry } from "../../../../../../lib/db";
import { rowValueForField } from "../../../../../../lib/gridRowValue";
import { loadInvoiceLinkedCaseByCaseId } from "../../../../../../lib/modules/invoiceCaseSnapshot";
import {
  buildRecoveryInvoicePdfBuffer,
  safeRecoveryInvoicePdfFilename
} from "../../../../../../lib/modules/recoveryInvoicePdf";
import { jsonApiErrorForAction } from "../../../../../../lib/apiErrorResponse";

const EMPTY_RECOVERY_NCI_ROW = {
  caseNo: "",
  entrustmentDate: "",
  borrower: "",
  loanAccountNo: "",
  loanTypeLabel: "",
  npaDate: "",
  caseStatusLabel: ""
};

// Bank / RBO / branch labels for the invoice PDF header (via branch_master chain).
async function loadBranchChainForRecoveryPdf(branchId) {
  if (!Number.isFinite(branchId) || branchId <= 0) {
    return { bankCode: "", bankName: "", rboName: "", branchDisplay: "", branchPlace: "" };
  }
  const [branchRows] = await queryWithRetry(
    `
    SELECT
      br.branchName,
      br.branchCode,
      br.place AS branchPlace,
      rbo.fullName AS rboFullName,
      rbo.shortCode AS rboShortCode,
      bm.bankCode,
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
    bankCode: String(rowValueForField(br, "bankCode") ?? "").trim(),
    bankName: String(rowValueForField(br, "bankName") ?? "").trim(),
    rboName,
    branchDisplay,
    branchPlace: String(rowValueForField(br, "branchPlace") ?? "").trim()
  };
}

// Unit code shown on printed invoices (from unit_master).
async function loadUnitShortCode(unitId) {
  if (!Number.isFinite(unitId) || unitId <= 0) return "";
  const [rows] = await queryWithRetry(`SELECT unitCode FROM unit_master WHERE id = ? LIMIT 1`, [unitId]);
  return String(rowValueForField(rows?.[0] || {}, "unitCode") ?? "").trim();
}

// NPA current account block on the invoice (account + IFSC + GST from masters).
async function loadCurrentAccountForPdf(caId) {
  if (!Number.isFinite(caId) || caId <= 0) return null;
  const [rows] = await queryWithRetry(
    `
    SELECT
      ca.accountName,
      ca.accountNo,
      ca.branch,
      ca.ifscCode,
      ca.gstNo,
      bm.bankName,
      bm.bankCode
    FROM current_account_master ca
    INNER JOIN bank_master bm ON bm.id = ca.bank
    WHERE ca.id = ?
    LIMIT 1
    `,
    [caId]
  );
  const row = rows?.[0];
  if (!row) return null;
  return {
    accountName: String(rowValueForField(row, "accountName") ?? "").trim(),
    accountNo: String(rowValueForField(row, "accountNo") ?? "").trim(),
    branch: String(rowValueForField(row, "branch") ?? "").trim(),
    ifscCode: String(rowValueForField(row, "ifscCode") ?? "").trim(),
    gstNo: String(rowValueForField(row, "gstNo") ?? "").trim(),
    bankName: String(rowValueForField(row, "bankName") ?? "").trim(),
    bankCode: String(rowValueForField(row, "bankCode") ?? "").trim()
  };
}

/**
 * GET /api/recovery-invoice/pdf/:id — download Recovery Invoice PDF.
 */
// Build Recovery Invoice PDF; CRUD layer enforces view permission on the invoice row.
export async function GET(req, { params }) {
  try {
    const auth = await requireRequestUser(req);
    if (auth.unauthorized) return auth.unauthorized;
    const user = auth.user;

    const { id } = await params;
    // Load invoice parent + recovery_charges child rows.
    const result = await getCrudRecordById(user, "recovery_invoice", id);
    if (result.status !== 200) {
      return Response.json(result.body, { status: result.status });
    }

    const { data, childTableRows } = result.body;
    const invoiceNo = String(rowValueForField(data, "invoiceNo") ?? "").trim();
    const charges = Array.isArray(childTableRows?.recovery_charges) ? childTableRows.recovery_charges : [];

    const caseId = Number(rowValueForField(data, "caseNo"));
    let nciRow = null;
    let amountRecoveredRows = [];
    let branchContext = { bankCode: "", bankName: "", rboName: "", branchDisplay: "", branchPlace: "" };
    let unitShortCode = "";

    if (Number.isFinite(caseId) && caseId > 0) {
      const linked = await loadInvoiceLinkedCaseByCaseId(caseId, { childKeys: ["amount_recovered"] });
      if (linked?.data) {
        nciRow = linked.data;
        amountRecoveredRows = Array.isArray(linked.childTableRows?.amount_recovered)
          ? linked.childTableRows.amount_recovered
          : [];
        const branchId = Number(rowValueForField(nciRow, "branch"));
        branchContext = await loadBranchChainForRecoveryPdf(branchId);
      }
    }

    const billToUnitId = Number(rowValueForField(data, "billToUnit"));
    if (Number.isFinite(billToUnitId) && billToUnitId > 0) {
      unitShortCode = await loadUnitShortCode(billToUnitId);
    }

    const caId = Number(rowValueForField(data, "npaCurrentAc"));
    const currentAccount = await loadCurrentAccountForPdf(caId);

    // Render fixed-layout PDF bytes (see lib/modules/recoveryInvoicePdf.js).
    const buffer = await buildRecoveryInvoicePdfBuffer({
      invoice: data,
      charges,
      nciRow: nciRow || EMPTY_RECOVERY_NCI_ROW,
      amountRecoveredRows,
      branchContext,
      unitShortCode,
      currentAccount
    });

    // Return as browser download (attachment), not inline display.
    const filename = safeRecoveryInvoicePdfFilename(invoiceNo || id);
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (e) {
    return jsonApiErrorForAction(e, "downloadPdf", { logLabel: "recovery-invoice pdf" });
  }
}

