// Application API route — SARFAESI Invoice PDF download.

/**
 * GET /api/sarfaesi-invoice/pdf/:id — 3-page SARFAESI Invoice PDF download.
 *
 * Loads: sarfaesi_invoice + sarfaesi_charges, linked case (NCI), branch chain, unit, current account.
 * Drawing: lib/modules/sarfaesiInvoicePdf.js — docs/sarfaesi-invoice-pdf.md, docs/invoices-pdf.md.
 */

import { cookies } from "next/headers";
import { getSessionUser } from "../../../../../lib/session";
import { getCrudRecordById } from "../../../../../lib/services/crud.service";
import { queryWithRetry } from "../../../../../lib/db";
import { rowValueForField } from "../../../../../lib/gridRowValue";
import {
  buildSarfaesiInvoicePdfBuffer,
  safeSarfaesiInvoicePdfFilename
} from "../../../../../lib/modules/sarfaesiInvoicePdf";
import { jsonApiErrorForAction } from "../../../../../lib/apiErrorResponse";

// Session cookie → logged-in user.
async function getRequestUser() {
  const cookieStore = await cookies();
  const sid = cookieStore.get("session")?.value;
  return getSessionUser(sid);
}

// Bank / RBO / branch text for SARFAESI invoice PDF header.
async function loadBranchChainForPdf(branchId) {
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
    rowValueForField(br, "rboFullName") ?? rowValueForField(br, "rboShortCode") ?? ""
  ).trim();
  return {
    bankCode: String(rowValueForField(br, "bankCode") ?? "").trim(),
    bankName: String(rowValueForField(br, "bankName") ?? "").trim(),
    rboName,
    branchDisplay,
    branchPlace: String(rowValueForField(br, "branchPlace") ?? "").trim()
  };
}

// Unit code for invoice letterhead.
async function loadUnitShortCode(unitId) {
  if (!Number.isFinite(unitId) || unitId <= 0) return "";
  const [rows] = await queryWithRetry(`SELECT unitCode FROM unit_master WHERE id = ? LIMIT 1`, [unitId]);
  return String(rowValueForField(rows?.[0] || {}, "unitCode") ?? "").trim();
}

// Payment details block from current_account_master + bank.
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

// SARFAESI Invoice PDF download (charges + case context).
export async function GET(_req, { params }) {
  try {
    const user = await getRequestUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const result = await getCrudRecordById(user, "sarfaesi_invoice", id);
    if (result.status !== 200) {
      return Response.json(result.body, { status: result.status });
    }

    const { data, childTableRows } = result.body;
    const invoiceNo = String(rowValueForField(data, "invoiceNo") ?? "").trim();
    const charges = Array.isArray(childTableRows?.sarfaesi_charges)
      ? childTableRows.sarfaesi_charges
      : [];

    const caseId = Number(rowValueForField(data, "caseNo"));
    let nciRow = null;
    let branchContext = { bankCode: "", bankName: "", rboName: "", branchDisplay: "", branchPlace: "" };
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

    if (!nciRow) {
      nciRow = {
        caseNo: String(rowValueForField(data, "caseNoLabel") ?? "").trim() || String(caseId || ""),
        borrower: "",
        loanAccountNo: "",
        loanTypeLabel: "",
        npaDate: "",
        caseStatusLabel: ""
      };
    }

    const caId = Number(rowValueForField(data, "npaCurrentAc"));
    const currentAccount = await loadCurrentAccountForPdf(caId);

    // Build PDF; layout is frozen in lib/modules/sarfaesiInvoicePdf.js.
    const buffer = await buildSarfaesiInvoicePdfBuffer({
      invoice: data,
      charges,
      nciRow,
      branchContext,
      unitShortCode,
      currentAccount
    });

    const filename = safeSarfaesiInvoicePdfFilename(invoiceNo || id);
    // Attachment response so browser saves the invoice PDF.
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (e) {
    return jsonApiErrorForAction(e, "downloadPdf", { logLabel: "sarfaesi-invoice pdf" });
  }
}
