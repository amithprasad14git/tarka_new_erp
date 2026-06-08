// Application API route — Public Notice PDF download.

/**
 * GET /api/public-notice/pdf/:id — builds and downloads the Public Notice PDF.
 * Loads notice + case + branch data; drawing in lib/modules/publicNoticePdf.js.
 */

import { cookies } from "next/headers";
import { getSessionUser } from "../../../../../lib/session";
import { getCrudRecordById } from "../../../../../lib/services/crud.service";
import { queryWithRetry } from "../../../../../lib/db";
import { rowValueForField } from "../../../../../lib/gridRowValue";
import { buildPublicNoticePdfBuffer, safePublicNoticePdfFilename } from "../../../../../lib/modules/publicNoticePdf";
import { jsonApiErrorForAction } from "../../../../../lib/apiErrorResponse";
import mysql from "mysql2";

// Session cookie → logged-in user.
async function getRequestUser() {
  const cookieStore = await cookies();
  const sid = cookieStore.get("session")?.value;
  return getSessionUser(sid);
}

// Map lookup_value_master ids to display text for notice person “type” column.
async function lookupValueLabelsByIds(ids) {
  const uniq = [...new Set(ids.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0))];
  if (!uniq.length) return new Map();
  const placeholders = uniq.map(() => "?").join(", ");
  const [rows] = await queryWithRetry(
    `SELECT id, lookupValue FROM ${mysql.escapeId("lookup_value_master")} WHERE id IN (${placeholders})`,
    uniq
  );
  const map = new Map();
  for (const r of rows || []) {
    map.set(Number(r.id), String(r.lookupValue ?? "").trim());
  }
  return map;
}

// Bank code and branch line for notice letterhead.
async function loadBranchChainForPdf(branchId) {
  if (!Number.isFinite(branchId) || branchId <= 0) {
    return { bankCode: "", rboName: "", branchDisplay: "" };
  }
  const [branchRows] = await queryWithRetry(
    `
    SELECT
      br.branchName,
      br.branchCode,
      rbo.fullName AS rboFullName,
      rbo.shortCode AS rboShortCode,
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
  const branchName = String(rowValueForField(br, "branchName") ?? "").trim();
  const branchCode = String(rowValueForField(br, "branchCode") ?? "").trim();
  const branchDisplay =
    branchName && branchCode ? `${branchName} (${branchCode})` : branchName || branchCode || "";
  const rboName = String(
    rowValueForField(br, "rboFullName") ?? rowValueForField(br, "rboShortCode") ?? ""
  ).trim();
  const bankCode = String(rowValueForField(br, "bankCode") ?? "").trim();
  return { bankCode, rboName, branchDisplay };
}

// Unit code printed on the notice.
async function loadUnitShortCode(unitId) {
  if (!Number.isFinite(unitId) || unitId <= 0) return "";
  const [rows] = await queryWithRetry(`SELECT unitCode FROM unit_master WHERE id = ? LIMIT 1`, [unitId]);
  return String(rowValueForField(rows?.[0] || {}, "unitCode") ?? "").trim();
}

/**
 * GET /api/public-notice/pdf/:id
 * Session + CRUD view scope; builds legacy-style Public Notice PDF (bank logo + dynamic columns).
 */
export async function GET(_req, { params }) {
  try {
    const user = await getRequestUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const result = await getCrudRecordById(user, "public_notice", id);
    if (result.status !== 200) {
      return Response.json(result.body, { status: result.status });
    }

    const { data, childTableRows } = result.body;
    const refNo = String(rowValueForField(data, "refNo") ?? "").trim();

    // Up to three persons from child grid; resolve “type” lookup ids to labels.
    const rawDetails = Array.isArray(childTableRows?.public_notice_details)
      ? childTableRows.public_notice_details
      : [];
    const typeIds = rawDetails.map((r) => Number(r?.type)).filter((n) => Number.isFinite(n) && n > 0);
    const typeLabels = await lookupValueLabelsByIds(typeIds);

    const persons = rawDetails.slice(0, 3).map((r) => ({
      displayName: String(r?.displayName ?? "").trim(),
      typeText: typeLabels.get(Number(r?.type)) || String(r?.type ?? "").trim(),
      address: String(r?.address ?? "").trim(),
      employeeOf: String(r?.employeeOf ?? r?.employee_of ?? "").trim()
    }));

    const caseId = Number(rowValueForField(data, "caseNo"));
    let nciRow = null;
    let branchContext = { bankCode: "", rboName: "", branchDisplay: "" };
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
        entrustmentDate: rowValueForField(data, "date"),
        branchLabel: "",
        loanAccountNo: "",
        closureBalance: ""
      };
    }

    const caseNoForFilename =
      String(rowValueForField(nciRow, "caseNo") ?? "").trim() ||
      String(rowValueForField(data, "caseNoLabel") ?? "").trim() ||
      refNo;

    // Legacy layout with bank logo — see lib/modules/publicNoticePdf.js.
    const buffer = await buildPublicNoticePdfBuffer({
      nciRow,
      branchContext,
      unitShortCode,
      persons
    });

    const filename = safePublicNoticePdfFilename(caseNoForFilename);
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (e) {
    return jsonApiErrorForAction(e, "downloadPdf", { logLabel: "public-notice pdf" });
  }
}

