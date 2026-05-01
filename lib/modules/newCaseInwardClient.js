// Module-specific file: contains business rules for this module only.
// Do not move this logic into generic/shared files.

import { useEffect, useMemo, useRef, useState } from "react";
import { getLookupRowLabelKey } from "../lookupLabelField";
import { rowValueForField } from "../gridRowValue";
import { FINAL_CASE_STATUS_SET, normalizeNciCaseStatusLabel } from "./newCaseInwardCaseStatus";
import { getYmdISTFromInstant, subtractCalendarDaysFromYmd } from "../istDateTime";
import { getNewCaseInwardStatusDotTone } from "./newCaseInwardViewRowTone";

/**
 * ============================================================================
 * NEW CASE INWARD (CLIENT-SIDE) MODULE FILE
 * ============================================================================
 * Layman summary:
 * - This file contains ONLY front-end behavior for the New Case Inward screen.
 * - It keeps special rules out of generic screens like MasterModuleClient.
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

export function canOpenNciFinalReadonlyRow(moduleKey, selectedRow) {
  return isNewCaseInwardModule(moduleKey) && selectedRow?._canEdit === false;
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
