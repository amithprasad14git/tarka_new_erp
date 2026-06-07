/**
 * newCaseInward — browser-only behaviour (forms, pickers, Print/download).
 * Server save rules: lib/modules/newCaseInward.js
 */

// Module-specific file: contains business rules for this module only.
// Do not move this logic into generic/shared files.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getLookupRowLabelKey } from "../lookupLabelField";
import { rowValueForField } from "../gridRowValue";
import { formatViewCellValue } from "../formatViewCellValue";
import { FINAL_CASE_STATUS_SET, normalizeNciCaseStatusLabel } from "./newCaseInwardCaseStatus";
import { getYmdISTFromInstant, subtractCalendarDaysFromYmd } from "../istDateTime";
import { getNewCaseInwardStatusDotTone } from "./newCaseInwardViewRowTone";

/**
 * ============================================================================
 * NEW CASE INWARD (CLIENT-SIDE) MODULE FILE
 * ============================================================================
 * Layman summary:
 * - This file contains ONLY front-end behavior for the New Case Inward screen.
 * - Core behavior lives here; MasterModuleClient only wires useNciViewRecordModal for this module.
 * - It does NOT run SQL; server-side business rules remain in lib/modules/newCaseInward.js.
 *
 * What this file does:
 * 1) Loads lookup/dropdown data needed only for New Case Inward.
 * 2) Loads transaction-control limits and converts them into helper text + min dates.
 * 3) Handles loan-account length rule based on selected branch.
 * 4) Provides New Case Inward print/download helpers.
 * 5) Exposes a single hook (useNewCaseInwardClientModel) that generic UI can call.
 * ============================================================================
 */

export const EMPTY_NCI_TXN_HINTS = Object.freeze({
  entrustmentDate: "",
  amountRecoveredDate: "",
  caseStatusUpdatedDate: ""
});

export const EMPTY_NCI_TXN_MIN_DATES = Object.freeze({
  entrustmentDate: "",
  amountRecoveredDate: "",
  caseStatusUpdatedDate: ""
});

export function isNewCaseInwardModule(moduleKey) {
  return moduleKey === "new_case_inward";
}

export function isNewCaseInwardAdmin(moduleKey, role) {
  return isNewCaseInwardModule(moduleKey) && Number(role) === 1;
}

export function getNciSessionUnitForNewEntry(moduleKey, role, unit) {
  if (!isNewCaseInwardModule(moduleKey)) return null;
  if (Number(role) !== 2) return null;
  return unit;
}

export function getNciEntryReadOnlyFields(moduleKey, editingRow, role, unit) {
  if (!isNewCaseInwardModule(moduleKey)) return null;
  if (editingRow) {
    if (Number(role) !== 1) return { entrustmentDate: true };
    return null;
  }
  if (Number(role) !== 2 || unit == null || String(unit).trim() === "") return null;
  return { unit: true };
}

export function getNciAckPrintLabel(configuredLabel) {
  return configuredLabel || "Print Branch Copy";
}

export function getNciCaseDetailsPrintButtonText() {
  return "Print Case Details";
}

export function getNciBranchCopyPrintButtonText() {
  return "Print Branch Copy";
}

export function getNciFinalStatusAckPayload(savedId) {
  return {
    id: savedId,
    value: "",
    title: "Final Status Saved",
    hint: "Final stage status is saved successfully. You can now print the Case Details PDF.",
    suppressValue: true,
    showPrintPdf: true,
    printButtonLabel: getNciCaseDetailsPrintButtonText(),
    printMode: "caseDetails"
  };
}

export function getNciDynamicFormLayoutSections(allInputFields, isEditingExistingRecord) {
  const nciCaseStatusFieldNames = new Set(["caseStatus", "caseStatusUpdatedDate", "caseStatusRemarks"]);
  if (!isEditingExistingRecord) return { mainFields: allInputFields, secondarySection: null };
  const mainFields = allInputFields.filter((f) => !nciCaseStatusFieldNames.has(f.name));
  const secondaryFields = allInputFields.filter((f) => nciCaseStatusFieldNames.has(f.name));
  return {
    mainFields,
    secondarySection:
      secondaryFields.length > 0
        ? {
            title: "Case Status Update",
            fields: secondaryFields
          }
        : null
  };
}

export function getNciPrintTargetId({ moduleKey, canView, effectiveViewMode, selectedId, editingRowId }) {
  if (!isNewCaseInwardModule(moduleKey) || !canView) return null;
  return effectiveViewMode ? selectedId : editingRowId ?? null;
}

export function shouldShowNciChildTables(moduleKey, hasChildTables, editingRow) {
  if (!hasChildTables) return false;
  if (isNewCaseInwardModule(moduleKey) && !editingRow) return false;
  return true;
}

function findTxnControlRow(rows, fieldName) {
  const expected = String(fieldName || "")
    .trim()
    .toLowerCase();
  return (rows || []).find((r) => {
    const candidate = String(rowValueForField(r, "field_name") || "")
      .trim()
      .toLowerCase();
    return candidate === expected;
  });
}

function ymdDaysAgoIST(days) {
  const n = Math.max(0, Math.floor(Number(days) || 0));
  return subtractCalendarDaysFromYmd(getYmdISTFromInstant(new Date()), n);
}

function txnHintByField(rows, fieldName) {
  const row = findTxnControlRow(rows, fieldName);
  if (!row) return "";
  const allow = String(rowValueForField(row, "allow_flag") || "Yes")
    .trim()
    .toLowerCase();
  if (allow === "yes") return `${fieldName}: no backdate restriction (Allow = Yes).`;
  const n = Number(rowValueForField(row, "days"));
  const days = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  return `${fieldName}: backdate allowed up to ${days} day(s).`;
}

function txnMinDateByField(rows, fieldName) {
  const row = findTxnControlRow(rows, fieldName);
  if (!row) return "";
  const allow = String(rowValueForField(row, "allow_flag") || "Yes")
    .trim()
    .toLowerCase();
  if (allow === "yes") return "";
  const n = Number(rowValueForField(row, "days"));
  const days = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  return ymdDaysAgoIST(days);
}

export function deriveTxnControlHints(rows) {
  return {
    entrustmentDate: txnHintByField(rows, "Entrustment Date"),
    amountRecoveredDate: txnHintByField(rows, "Amount Recovered"),
    caseStatusUpdatedDate: txnHintByField(rows, "Case Status Update")
  };
}

export function deriveTxnControlMinDates(rows) {
  return {
    entrustmentDate: txnMinDateByField(rows, "Entrustment Date"),
    amountRecoveredDate: txnMinDateByField(rows, "Amount Recovered"),
    caseStatusUpdatedDate: txnMinDateByField(rows, "Case Status Update")
  };
}

export async function fetchNciEntryLookups() {
  const res = await fetch("/api/new-case-inward/entry-lookups");
  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(payload?.error || "Failed to load entry lookups");
  return payload?.data && typeof payload.data === "object" ? payload.data : {};
}

export async function fetchNciLoanRuleByBranch(branchId) {
  const id = Number(branchId);
  if (!Number.isFinite(id) || id <= 0) {
    return { bankName: "", loanAccountNoLength: null };
  }
  const res = await fetch(`/api/new-case-inward/loan-account-rule?branchId=${id}`);
  const payload = await res.json();
  const len = Number(payload?.loanAccountNoLength);
  return {
    bankName: String(payload?.bankName ?? "").trim(),
    loanAccountNoLength: Number.isFinite(len) && len > 0 ? len : null
  };
}

export async function fetchNciTransactionControlRows() {
  let res = await fetch("/api/new-case-inward/transaction-control");
  let text = await res.text();
  let payload = text ? JSON.parse(text) : null;
  if (!res.ok) {
    res = await fetch("/api/crud/new_case_inward_transaction_control?page=1&limit=50&sortBy=id&sortDir=desc");
    text = await res.text();
    payload = text ? JSON.parse(text) : null;
  }
  if (!res.ok) throw new Error(payload?.error || "Failed to load transaction control rows");
  return Array.isArray(payload?.data) ? payload.data : [];
}

export function getNciEntryFieldUiOverrides({ moduleKey, loanAccountRule, loanAccountNoDraft, isAdmin, hints, minDates }) {
  if (moduleKey !== "new_case_inward") return null;
  const len = Number(loanAccountRule?.loanAccountNoLength);
  const hasRule = Number.isFinite(len) && len > 0;
  if (!hasRule) {
    return {
      loanAccountNo: { placeholder: "Enter Loan Account No" },
      entrustmentDate: {
        helperText: isAdmin ? "" : hints.entrustmentDate || "",
        min: isAdmin ? "" : minDates.entrustmentDate || undefined
      },
      caseStatusUpdatedDate: {
        helperText: isAdmin ? "" : hints.caseStatusUpdatedDate || "",
        min: isAdmin ? "" : minDates.caseStatusUpdatedDate || undefined
      }
    };
  }
  const currentLen = String(loanAccountNoDraft ?? "").trim().length;
  const mismatch = currentLen !== len;
  const bank = String(loanAccountRule?.bankName || "").trim();
  const bankSuffix = bank ? ` for ${bank}` : "";
  return {
    loanAccountNo: {
      placeholder: `Enter ${len}-character Loan Account No`,
      maxLength: len,
      helperText: mismatch ? `Required length${bankSuffix}: ${len} characters` : "",
      helperTone: "error"
    },
    entrustmentDate: {
      helperText: isAdmin ? "" : hints.entrustmentDate || "",
      min: isAdmin ? "" : minDates.entrustmentDate || undefined
    },
    caseStatusUpdatedDate: {
      helperText: isAdmin ? "" : hints.caseStatusUpdatedDate || "",
      min: isAdmin ? "" : minDates.caseStatusUpdatedDate || undefined
    }
  };
}

export function getNciChildFieldUiOverrides({ moduleKey, isAdmin, hints, minDates }) {
  if (moduleKey !== "new_case_inward") return null;
  return {
    amount_recovered: {
      recoveredDate: {
        helperText: isAdmin ? "" : hints.amountRecoveredDate || "",
        min: isAdmin ? "" : minDates.amountRecoveredDate || undefined
      }
    }
  };
}

export function getNciDisableLookupRemoteByField({ moduleKey, fields }) {
  if (moduleKey !== "new_case_inward") return null;
  const out = {};
  for (const f of fields || []) {
    if (f?.type !== "lookup" || !f.lookup) continue;
    const ui = String(f.lookup.ui || "").trim().toLowerCase();
    const isPicker = ui === "picker" || ui === "popup" || ui === "modal" || ui === "dialog";
    if (!isPicker) out[f.name] = true;
  }
  return out;
}

export function getNciEntryModeConfig(config, moduleKey, editingRow) {
  if (!config) return config;
  if (moduleKey !== "new_case_inward" || editingRow) return config;
  const hiddenOnNew = new Set(["caseStatus", "caseStatusUpdatedDate", "caseStatusRemarks"]);
  return {
    ...config,
    fields: (config.fields || []).filter((f) => !hiddenOnNew.has(f.name))
  };
}

export function getNciCaseStatusField(config, moduleKey) {
  if (moduleKey !== "new_case_inward") return null;
  const f = (config?.fields || []).find((x) => x.name === "caseStatus");
  return f && f.type === "lookup" ? f : null;
}

export function getNciStatusLabelFromRow(row, caseStatusField) {
  return (
    rowValueForField(row, getLookupRowLabelKey(caseStatusField)) ??
    rowValueForField(row, "caseStatus") ??
    ""
  );
}

export async function fetchNciFinalStatusAckPayload({ moduleKey, editingRow, payload, caseStatusField }) {
  if (!editingRow || !isNewCaseInwardModule(moduleKey)) return null;
  const savedIdRaw = payload?.id ?? editingRow?.id;
  const savedId = Number(savedIdRaw);
  if (!Number.isFinite(savedId) || savedId <= 0) return null;
  try {
    const statusRes = await fetch(`/api/crud/${moduleKey}/${savedId}`);
    const statusTextRaw = await statusRes.text();
    const statusPayload = statusTextRaw ? JSON.parse(statusTextRaw) : null;
    if (!statusRes.ok || !statusPayload?.data) return null;
    const statusLabel = getNciStatusLabelFromRow(statusPayload.data, caseStatusField);
    if (!isNciFinalStatus(statusLabel)) return null;
    return getNciFinalStatusAckPayload(savedId);
  } catch {
    return null;
  }
}

export function getNciDotTone(row, caseStatusField) {
  return getNewCaseInwardStatusDotTone(getNciStatusLabelFromRow(row, caseStatusField));
}

export function isNciFinalStatus(statusLabel) {
  return FINAL_CASE_STATUS_SET.has(normalizeNciCaseStatusLabel(statusLabel));
}

export function validateNciSubmitBody(body, editingRow) {
  // Client-side guard before POST: status changes must include date and remarks.
  if (editingRow) {
    const hasCaseStatus =
      body.caseStatus != null &&
      String(body.caseStatus).trim() !== "" &&
      Number.isFinite(Number(body.caseStatus)) &&
      Number(body.caseStatus) > 0;
    const hasCaseStatusUpdatedDate = String(body.caseStatusUpdatedDate ?? "").trim() !== "";
    const hasCaseStatusRemarks = String(body.caseStatusRemarks ?? "").trim() !== "";
    if (hasCaseStatus && (!hasCaseStatusUpdatedDate || !hasCaseStatusRemarks)) {
      return "When Case Status is selected, Case Status Updated Date and Case Status Remarks are required.";
    }
  }
  const cs = body.caseStatus;
  const hasCaseStatus =
    cs != null &&
    String(cs).trim() !== "" &&
    Number.isFinite(Number(cs)) &&
    Number(cs) > 0;
  if (hasCaseStatus && String(body.caseStatusRemarks ?? "").trim() === "") {
    return "Case Status Remarks is required when Case Status is selected.";
  }
  return null;
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadNciCaseDetailsPdf(id, caseNoHint = null) {
  if (id == null) return;
  const res = await fetch(`/api/new-case-inward/case-details-pdf/${id}`);
  if (!res.ok) {
    const text = await res.text();
    let msg = "Failed to generate PDF";
    try {
      const j = JSON.parse(text);
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const safe = String(caseNoHint ?? id)
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120) || "case";
  triggerBlobDownload(blob, `CASE_DETAILS_${safe}.pdf`);
}

export async function downloadNciBranchCopyPdf(id, caseNoHint = null) {
  if (id == null) return;
  const res = await fetch(`/api/new-case-inward/branch-copy-pdf/${id}`);
  if (!res.ok) {
    const text = await res.text();
    let msg = "Failed to generate Branch Copy PDF";
    try {
      const j = JSON.parse(text);
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const safe = String(caseNoHint ?? id)
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120) || "CASE";
  triggerBlobDownload(blob, `${safe}_BRANCH_COPY.pdf`);
}

export async function fetchSavedNciCaseNo(recordId) {
  const res = await fetch(`/api/crud/new_case_inward/${recordId}`);
  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;
  if (!res.ok || !payload?.data) return "";
  return String(rowValueForField(payload.data, "caseNo") ?? "").trim();
}

/**
 * New Case Inward client model (layman):
 * Keeps all NCI-only screen behavior in one place so generic screens do not carry custom rules.
 * It handles:
 * - Loading NCI entry lookups
 * - Loading transaction-control hints/min dates
 * - Tracking branch/loan-account draft and deriving loan length rule
 * - Producing UI overrides used by DynamicForm and child tables
 * - Lightweight on-field change handling for NCI-only fields
 */
export function useNewCaseInwardClientModel({
  moduleKey,
  isActive,
  config,
  editingRow,
  entryFormInitialValues,
  isAdmin
}) {
  const [loanAccountNoDraft, setLoanAccountNoDraft] = useState("");
  const [loanAccountRule, setLoanAccountRule] = useState({ bankName: "", loanAccountNoLength: null });
  const [selectedBranchIdForLoanRule, setSelectedBranchIdForLoanRule] = useState(null);
  const [txnHints, setTxnHints] = useState(EMPTY_NCI_TXN_HINTS);
  const [txnMinDates, setTxnMinDates] = useState(EMPTY_NCI_TXN_MIN_DATES);
  const [lookupOptionsByField, setLookupOptionsByField] = useState({});
  const lookupsLoadedKeyRef = useRef("");
  const lookupsInFlightKeyRef = useRef("");
  const txnControlLoadedKeyRef = useRef("");
  const txnControlInFlightKeyRef = useRef("");

  useEffect(() => {
    if (!isNewCaseInwardModule(moduleKey) || !isActive) {
      setLookupOptionsByField({});
      lookupsLoadedKeyRef.current = "";
      lookupsInFlightKeyRef.current = "";
      return;
    }
    const loadKey = `${moduleKey}|entry-lookups`;
    if (lookupsLoadedKeyRef.current === loadKey) return;
    if (lookupsInFlightKeyRef.current === loadKey) return;
    lookupsInFlightKeyRef.current = loadKey;
    let cancelled = false;
    async function run() {
      try {
        const next = await fetchNciEntryLookups();
        if (!cancelled) {
          setLookupOptionsByField(next);
          lookupsLoadedKeyRef.current = loadKey;
        }
      } catch {
        if (!cancelled) setLookupOptionsByField({});
      } finally {
        if (lookupsInFlightKeyRef.current === loadKey) {
          lookupsInFlightKeyRef.current = "";
        }
      }
    }
    run();
    return () => {
      cancelled = true;
      if (lookupsInFlightKeyRef.current === loadKey) {
        lookupsInFlightKeyRef.current = "";
      }
    };
  }, [moduleKey, isActive]);

  useEffect(() => {
    if (!isNewCaseInwardModule(moduleKey)) {
      setSelectedBranchIdForLoanRule(null);
      setLoanAccountRule({ bankName: "", loanAccountNoLength: null });
      setLoanAccountNoDraft("");
      return;
    }
    const branchRaw = editingRow ? editingRow?.branch : entryFormInitialValues?.branch;
    const branchNum = Number(branchRaw);
    setSelectedBranchIdForLoanRule(Number.isFinite(branchNum) ? branchNum : null);
    const loanNoRaw = editingRow ? editingRow?.loanAccountNo : entryFormInitialValues?.loanAccountNo;
    setLoanAccountNoDraft(String(loanNoRaw ?? ""));
  }, [moduleKey, editingRow, entryFormInitialValues]);

  useEffect(() => {
    if (!isNewCaseInwardModule(moduleKey)) return;
    const branchId = Number(selectedBranchIdForLoanRule);
    if (!Number.isFinite(branchId) || branchId <= 0) {
      setLoanAccountRule({ bankName: "", loanAccountNoLength: null });
      return;
    }
    let cancelled = false;
    async function run() {
      try {
        const next = await fetchNciLoanRuleByBranch(branchId);
        if (!cancelled) setLoanAccountRule(next);
      } catch {
        if (!cancelled) setLoanAccountRule({ bankName: "", loanAccountNoLength: null });
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [moduleKey, selectedBranchIdForLoanRule]);

  useEffect(() => {
    if (!isNewCaseInwardModule(moduleKey) || !isActive) {
      setTxnHints(EMPTY_NCI_TXN_HINTS);
      setTxnMinDates(EMPTY_NCI_TXN_MIN_DATES);
      txnControlLoadedKeyRef.current = "";
      txnControlInFlightKeyRef.current = "";
      return;
    }
    const loadKey = `${moduleKey}|transaction-control`;
    if (txnControlLoadedKeyRef.current === loadKey) return;
    if (txnControlInFlightKeyRef.current === loadKey) return;
    txnControlInFlightKeyRef.current = loadKey;
    let cancelled = false;
    async function run() {
      try {
        const rows = await fetchNciTransactionControlRows();
        if (cancelled) return;
        setTxnHints(deriveTxnControlHints(rows));
        setTxnMinDates(deriveTxnControlMinDates(rows));
        txnControlLoadedKeyRef.current = loadKey;
      } catch {
        if (!cancelled) {
          setTxnHints(EMPTY_NCI_TXN_HINTS);
          setTxnMinDates(EMPTY_NCI_TXN_MIN_DATES);
        }
      } finally {
        if (txnControlInFlightKeyRef.current === loadKey) {
          txnControlInFlightKeyRef.current = "";
        }
      }
    }
    run();
    return () => {
      cancelled = true;
      if (txnControlInFlightKeyRef.current === loadKey) {
        txnControlInFlightKeyRef.current = "";
      }
    };
  }, [moduleKey, isActive]);

  function onFieldValueChange(fieldName, value) {
    if (!isNewCaseInwardModule(moduleKey)) return false;
    if (fieldName === "branch") {
      const n = Number(value);
      setSelectedBranchIdForLoanRule(Number.isFinite(n) ? n : null);
      return true;
    }
    if (fieldName === "loanAccountNo") {
      setLoanAccountNoDraft(String(value ?? ""));
      return true;
    }
    return true;
  }

  const entryFieldUiOverrides = useMemo(
    () =>
      getNciEntryFieldUiOverrides({
        moduleKey,
        loanAccountRule,
        loanAccountNoDraft,
        isAdmin,
        hints: txnHints,
        minDates: txnMinDates
      }),
    [moduleKey, loanAccountRule, loanAccountNoDraft, isAdmin, txnHints, txnMinDates]
  );

  const childFieldUiOverrides = useMemo(
    () =>
      getNciChildFieldUiOverrides({
        moduleKey,
        isAdmin,
        hints: txnHints,
        minDates: txnMinDates
      }),
    [moduleKey, isAdmin, txnHints, txnMinDates]
  );

  const disableLookupRemoteByField = useMemo(
    () => getNciDisableLookupRemoteByField({ moduleKey, fields: config?.fields || [] }),
    [moduleKey, config]
  );

  const entryModeConfig = useMemo(
    () => getNciEntryModeConfig(config, moduleKey, editingRow),
    [config, moduleKey, editingRow]
  );

  return {
    lookupOptionsByField,
    disableLookupRemoteByField,
    entryFieldUiOverrides,
    childFieldUiOverrides,
    entryModeConfig,
    onFieldValueChange
  };
}

/** Keep in sync with `NEW_CASE_INWARD_VIEW_RECORD_MODAL_TITLE` in `./newCaseInward.js` (client avoids importing that file). */
const NCI_VIEW_RECORD_MODAL_TITLE = "Case Snapshot (Read-only)";

/** Keep in sync with `NEW_CASE_INWARD_VIEW_GRID_PEEK_*` in `./newCaseInward.js`. */
export const NCI_VIEW_GRID_PEEK_COLUMN_HEADER = "Peek";
const NCI_VIEW_GRID_PEEK_BUTTON_TOOLTIP = "Quick view record (read-only)";

const NCI_MODAL_INR_FORMAT = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0
});

function formatNciModalInr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return NCI_MODAL_INR_FORMAT.format(n);
}

/** Closure balance label: INR symbol + space before amount (Intl omits the gap). */
function formatNciModalClosureBalanceInr(value) {
  const s = formatNciModalInr(value);
  if (s === "—") return s;
  const i = s.indexOf("\u20B9");
  if (i === -1) return s;
  if (s.slice(i, i + 2) === "\u20B9 ") return s;
  return `${s.slice(0, i)}\u20B9 ${s.slice(i + 1)}`;
}

function sumNciRecoveredAmounts(rows) {
  return (rows || []).reduce((acc, row) => {
    const v = rowValueForField(row, "recoveredAmount");
    const n = Number(v);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}

/** `%` widths for `<col>` → total 100%; `table-layout: fixed` keeps the grid inside the modal. */
function nciModalAmountColPercents(columns) {
  const list = columns || [];
  const amtCt = list.filter((c) => c.name === "recoveredAmount").length;
  const nonCt = list.length - amtCt;
  if (list.length === 0) return [];
  if (amtCt === 0) {
    const e = 100 / list.length;
    return list.map(() => e);
  }
  if (nonCt === 0) {
    const e = 100 / amtCt;
    return list.map(() => e);
  }
  const wAmt = 42 / amtCt;
  const wNon = 58 / nonCt;
  return list.map((c) => (c.name === "recoveredAmount" ? wAmt : wNon));
}

/** Full module `fields` list for read-only modal (grid `showInView` / form `excludeFromForm` do not apply). */
function nciParentFieldsForReadonlyModal(fieldDefs) {
  return Array.isArray(fieldDefs) ? fieldDefs.slice() : [];
}

function formatNciModalParentCell(f, row) {
  if (!row) return "—";
  if (f.type === "lookup") {
    const l = rowValueForField(row, getLookupRowLabelKey(f));
    if (l != null && String(l).trim() !== "") return String(l).trim();
  }
  const raw = rowValueForField(row, f.name);
  if (raw == null || raw === "") return "—";
  if (f.name === "closureBalance" && f.type === "number") {
    return formatNciModalClosureBalanceInr(raw);
  }
  const s = formatViewCellValue(f, raw);
  return String(s).trim() === "" ? "—" : String(s);
}

function formatNciModalChildCell(f, row) {
  if (!row) return "—";
  if (f.type === "lookup") {
    const l = rowValueForField(row, getLookupRowLabelKey(f));
    if (l != null && String(l).trim() !== "") return String(l).trim();
  }
  if (f.type === "checkbox") {
    const v = rowValueForField(row, f.name);
    if (v === true || Number(v) === 1 || String(v).trim() === "1") return "Yes";
    if (v === false || Number(v) === 0 || String(v).trim() === "0") return "No";
  }
  const raw = rowValueForField(row, f.name);
  if (raw == null || raw === "") return "—";
  if (f.name === "recoveredAmount" && f.type === "number") {
    return formatNciModalInr(raw);
  }
  const s = formatViewCellValue(f, raw);
  return String(s).trim() === "" ? "—" : String(s);
}

export function buildNciReadonlyModalDetail(payload, moduleConfig) {
  const parent = payload?.data;
  if (!parent) return null;
  const childPayload = payload?.childTableRows && typeof payload.childTableRows === "object" ? payload.childTableRows : {};
  const allFields = Array.isArray(moduleConfig?.fields) ? moduleConfig.fields : [];
  const parentFields = nciParentFieldsForReadonlyModal(allFields);
  const { mainFields, secondarySection } = getNciDynamicFormLayoutSections(parentFields, Boolean(parent.id));

  const sections = [];
  sections.push({
    title: null,
    rows: mainFields.map((f) => ({
      label: f.label || f.name,
      value: formatNciModalParentCell(f, parent)
    }))
  });
  if (secondarySection?.fields?.length) {
    sections.push({
      title: secondarySection.title || "Case status",
      rows: secondarySection.fields.map((f) => ({
        label: f.label || f.name,
        value: formatNciModalParentCell(f, parent)
      }))
    });
  }

  const childBlocks = [];
  for (const ct of moduleConfig?.childTables || []) {
    const key = ct.key || ct.table;
    const rows = childPayload[key];
    const cols = Array.isArray(ct.fields) ? ct.fields.slice() : [];
    const dataRows = Array.isArray(rows) && rows.length > 0 ? rows : [];
    childBlocks.push({
      key,
      title: ct.label || key,
      columns: cols,
      rows: dataRows
    });
  }

  return { sections, childBlocks, recordId: parent.id };
}

/**
 * Read-only “Peek” layout: all parent fields (sections) + child tables (e.g. amount recovered).
 * Shared by NCI grid peek modal and Case Snapshot modal.
 */
export function NciCasePeekDetailContent({ detail }) {
  if (!detail?.sections) return null;
  return (
    <>
      {detail.sections.map((sec, si) => (
        <div key={si} style={{ marginBottom: "16px" }}>
          {sec.title ? <h4 style={{ margin: "0 0 8px", fontSize: "14px" }}>{sec.title}</h4> : null}
          <div className="audit-compare-table-wrap" style={{ padding: 0 }}>
            <table className="audit-compare-table pn-snapshot-table">
              <tbody>
                {sec.rows.map((r, ri) => (
                  <tr key={ri}>
                    <td>{r.label}</td>
                    <td style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {(detail.childBlocks || []).map((block) => {
        const compactAmountRecovered = block.key === "amount_recovered";
        const wrapStyle = compactAmountRecovered
          ? {
              width: "50%",
              maxWidth: "100%",
              minWidth: 0,
              boxSizing: "border-box",
              maxHeight: "96px",
              overflowY: "auto",
              overflowX: "hidden",
              WebkitOverflowScrolling: "touch",
              fontSize: "12px",
              lineHeight: 1.35
            }
          : { maxHeight: "240px", overflow: "auto" };
        const cellPad = compactAmountRecovered ? { padding: "3px 6px" } : undefined;
        const amoCellReset = compactAmountRecovered
          ? {
              maxWidth: "none",
              whiteSpace: "normal",
              wordBreak: "break-word",
              overflowWrap: "break-word"
            }
          : undefined;
        return (
          <div key={block.key} style={{ marginBottom: compactAmountRecovered ? "12px" : "18px" }}>
            <h4
              style={{
                margin: "0 0 6px",
                fontSize: compactAmountRecovered ? "13px" : "14px"
              }}
            >
              {block.title}
            </h4>
            {block.columns.length === 0 ? (
              <p className="subtle">No columns configured.</p>
            ) : block.rows.length === 0 ? (
              <p className="subtle">No Records.</p>
            ) : (
              <div className="table-wrap" style={wrapStyle}>
                <table
                  className="data-table data-table-compact"
                  style={
                    compactAmountRecovered
                      ? {
                          width: "100%",
                          maxWidth: "100%",
                          minWidth: 0,
                          tableLayout: "fixed",
                          boxSizing: "border-box"
                        }
                      : { minWidth: "100%", tableLayout: "auto" }
                  }
                >
                  {compactAmountRecovered && block.columns.length > 0 ? (
                    <colgroup>
                      {nciModalAmountColPercents(block.columns).map((pct, idx) => (
                        <col key={`col-${block.columns[idx].name}-${idx}`} style={{ width: `${pct}%` }} />
                      ))}
                    </colgroup>
                  ) : null}
                  <thead>
                    <tr>
                      {block.columns.map((cf) => {
                        const amountCol = cf.name === "recoveredAmount";
                        return (
                          <th
                            key={cf.name}
                            style={{
                              ...amoCellReset,
                              ...cellPad,
                              ...(compactAmountRecovered && amountCol
                                ? { textAlign: "right", whiteSpace: "nowrap" }
                                : {})
                            }}
                          >
                            {cf.label || cf.name}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, ridx) => (
                      <tr key={ridx}>
                        {block.columns.map((cf) => {
                          const amountCol = cf.name === "recoveredAmount";
                          return (
                            <td
                              key={cf.name}
                              style={{
                                ...amoCellReset,
                                ...cellPad,
                                ...(compactAmountRecovered && amountCol
                                  ? {
                                      textAlign: "right",
                                      fontVariantNumeric: "tabular-nums",
                                      whiteSpace: "nowrap"
                                    }
                                  : { whiteSpace: "normal" })
                              }}
                            >
                              {formatNciModalChildCell(cf, row)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  {compactAmountRecovered ? (() => {
                    const amountIdx = block.columns.findIndex((c) => c.name === "recoveredAmount");
                    if (amountIdx < 0 || block.rows.length === 0) return null;
                    const recoveredSum = sumNciRecoveredAmounts(block.rows);
                    const footStrong = { fontWeight: 600, ...cellPad };
                    const topRule = { borderTop: "1px solid var(--border, #ddd)" };
                    if (amountIdx === 0) {
                      return (
                        <tfoot>
                          <tr>
                            <td key="foot-total-span" colSpan={block.columns.length} style={{ ...footStrong, ...topRule }}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: "8px"
                                }}
                              >
                                <span>Total</span>
                                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                                  {formatNciModalInr(recoveredSum)}
                                </span>
                              </div>
                            </td>
                          </tr>
                        </tfoot>
                      );
                    }
                    return (
                      <tfoot>
                        <tr>
                          <td
                            key="foot-total"
                            colSpan={amountIdx}
                            style={{ ...footStrong, ...topRule, verticalAlign: "middle" }}
                          >
                            Total
                          </td>
                          <td
                            key="foot-recovered-sum"
                            style={{ ...footStrong, ...topRule, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                          >
                            {formatNciModalInr(recoveredSum)}
                          </td>
                          {block.columns.slice(amountIdx + 1).map((cf) => (
                            <td key={`foot-after-${cf.name}`} style={{ ...cellPad, ...topRule }} />
                          ))}
                        </tr>
                      </tfoot>
                    );
                  })() : null}
                </table>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function NciPeekMagnifyingGlassIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <line x1="16.65" y1="16.65" x2="21" y2="21" />
    </svg>
  );
}

/**
 * Icon-only peek control for each NCI grid row (`MasterModuleClient` wires `onPeek` → `openViewRecord`).
 */
export function NciViewRecordPeekButton({ recordId, disabled, onPeek }) {
  const id = recordId != null ? Number(recordId) : NaN;
  const canAct = Number.isFinite(id) && id > 0;
  return (
    <button
      type="button"
      className="audit-json-open"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        margin: 0,
        padding: "1px 2px",
        minWidth: 0,
        lineHeight: 0,
        borderRadius: "4px"
      }}
      disabled={Boolean(disabled) || !canAct}
      aria-label={`${NCI_VIEW_GRID_PEEK_BUTTON_TOOLTIP} (id ${canAct ? id : recordId ?? "—"})`}
      title={NCI_VIEW_GRID_PEEK_BUTTON_TOOLTIP}
      onClick={(e) => {
        e.stopPropagation();
        if (!canAct) return;
        void onPeek?.();
      }}
    >
      <NciPeekMagnifyingGlassIcon />
    </button>
  );
}

function NciViewRecordModal({ open, onClose, loading, error, detail }) {
  if (!open) return null;

  return (
    <div className="audit-json-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="audit-json-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nci-view-record-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "min(920px, 100%)", maxHeight: "90vh" }}
      >
        <div className="audit-json-modal-header">
          <h3 id="nci-view-record-modal-title" className="audit-json-modal-title">
            {NCI_VIEW_RECORD_MODAL_TITLE}
          </h3>
          <button type="button" className="audit-json-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div style={{ padding: "12px 14px", overflow: "auto", maxHeight: "calc(90vh - 56px)" }}>
          {error ? (
            <p className="subtle" role="alert" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          ) : loading ? (
            <div className="pn-skeleton-card" aria-hidden>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="pn-skeleton-row">
                  <span className="pn-skeleton-cell pn-skeleton-cell-label" />
                  <span className="pn-skeleton-cell pn-skeleton-cell-value" />
                </div>
              ))}
            </div>
          ) : detail ? (
            <NciCasePeekDetailContent detail={detail} />
          ) : (
            <p className="subtle">No data.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Read-only full-record modal for NCI grid rows with `_canEdit === false` (and same data as GET /crud/new_case_inward/:id).
 * Render `viewRecordModal` next to other modals; call `openViewRecord(id)` from the master screen.
 */
export function useNciViewRecordModal({ moduleKey, moduleConfig }) {
  const enabled = isNewCaseInwardModule(moduleKey);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);

  const close = useCallback(() => {
    setOpen(false);
    setDetail(null);
    setError(null);
    setLoading(false);
  }, []);

  const openViewRecord = useCallback(
    async (recordId) => {
      if (!enabled || recordId == null) return;
      const id = Number(recordId);
      if (!Number.isFinite(id) || id <= 0) return;
      setOpen(true);
      setLoading(true);
      setError(null);
      setDetail(null);
      try {
        const res = await fetch(`/api/crud/new_case_inward/${id}`);
        const text = await res.text();
        const payload = text ? JSON.parse(text) : null;
        if (!res.ok || !payload?.data) {
          setError(payload?.error || "Failed to load record");
          setDetail(null);
          return;
        }
        setDetail(buildNciReadonlyModalDetail(payload, moduleConfig));
      } catch (e) {
        setError(e?.message || "Failed to load record");
        setDetail(null);
      } finally {
        setLoading(false);
      }
    },
    [enabled, moduleConfig]
  );

  const viewRecordModal = useMemo(() => {
    if (!enabled) return null;
    return <NciViewRecordModal open={open} onClose={close} loading={loading} error={error} detail={detail} />;
  }, [enabled, open, close, loading, error, detail]);

  return { enabled, openViewRecord, closeViewRecord: close, viewRecordModal };
}

