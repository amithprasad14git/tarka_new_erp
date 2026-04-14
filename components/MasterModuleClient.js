"use client";

/**
 * “Master” style screen for one module: single-record entry form, saved-rows grid, filters, and
 * Flux-style actions (save / view / clear). Uses RBAC from `/api/permissions/:module` for buttons.
 */
import { useEffect, useMemo, useState } from "react";
import { modules } from "../config/modules";
import { labelWithRequiredMark } from "../lib/formFieldLabel";
import { formatViewCellValue } from "../lib/formatViewCellValue";
// Grid rows may use mixed column name casing from MySQL; see lib/gridRowValue.js.
import { rowValueForField } from "../lib/gridRowValue";
import { getLookupRowLabelKey } from "../lib/lookupLabelField";
import { getNewCaseInwardStatusDotTone } from "../lib/newCaseInwardViewRowTone";
import PostCreateAckModal from "./PostCreateAckModal";
import DynamicForm from "./DynamicForm";
import LoadingOverlay from "./LoadingOverlay";
import MasterActionsMenu from "./MasterActionsMenu";
import ModuleChildTablesPanel, { newChildRowDraft } from "./ModuleChildTablesPanel";
import PaginationBar from "./PaginationBar";
import ToastNotice from "./ToastNotice";

function emptyChildRowsState(childTables) {
  if (!childTables?.length) return {};
  const o = {};
  for (const t of childTables) o[t.key || t.table] = [newChildRowDraft()];
  return o;
}

/** Maps GET `/api/crud/:module/:id` `childTableRows` into grid state (saved lines, stable `_rowId`). */
function childRowsStateFromApi(childTables, childTableRows) {
  if (!childTables?.length) return {};
  const o = {};
  for (const ct of childTables) {
    const key = ct.key || ct.table;
    const rows = childTableRows?.[key];
    if (Array.isArray(rows) && rows.length > 0) {
      o[key] = rows.map((r, idx) => {
        const { id: childId, ...rest } = r;
        return {
          ...rest,
          _rowId:
            childId != null
              ? `db-${childId}`
              : `tmp-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 9)}`,
          _editing: false,
          _lineSaved: true
        };
      });
    } else {
      o[key] = [newChildRowDraft()];
    }
  }
  return o;
}

function rowHasAnyContent(row, fields) {
  for (const f of fields) {
    const v = row[f.name];
    if (v !== null && v !== undefined && String(v).trim() !== "") return true;
  }
  return false;
}

function validateChildTableRows(moduleConfig, childRowsByKey) {
  const tables = moduleConfig.childTables || [];
  for (const ct of tables) {
    const key = ct.key || ct.table;
    const rows = childRowsByKey[key] || [];
    const fields = ct.fields || [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!rowHasAnyContent(row, fields)) continue;
      if (row._editing || !row._lineSaved) {
        return `${ct.label || key}, row ${i + 1}: use Save on the line before saving the parent record.`;
      }
      for (const f of fields) {
        if (!f.required) continue;
        const v = row[f.name];
        const empty = v === null || v === undefined || (typeof v === "string" && !String(v).trim());
        if (empty) {
          return `${ct.label || key}, row ${i + 1}: ${f.label || f.name} is required.`;
        }
        if (f.type === "number") {
          const n = Number(v);
          if (!Number.isFinite(n)) {
            return `${ct.label || key}, row ${i + 1}: ${f.label || f.name} must be a valid number.`;
          }
        }
      }
    }
  }
  return null;
}

function stripChildRowsForApi(childTables, childRowsByKey) {
  const out = {};
  for (const ct of childTables) {
    const key = ct.key || ct.table;
    const fields = ct.fields || [];
    out[key] = (childRowsByKey[key] || [])
      .filter((row) => row._lineSaved && rowHasAnyContent(row, fields))
      .map((row) => {
        const obj = {};
        for (const f of fields) {
          const v = row[f.name];
          if (f.type === "number") {
            if (v === "" || v == null) obj[f.name] = null;
            else {
              const n = Number(v);
              obj[f.name] = Number.isFinite(n) ? n : null;
            }
          } else if (v === "") {
            obj[f.name] = null;
          } else {
            obj[f.name] = v;
          }
        }
        return obj;
      });
  }
  return out;
}

function prettyAuditJsonText(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function auditJsonPreview(raw, max = 34) {
  const p = prettyAuditJsonText(raw).replace(/\s+/g, " ").trim();
  if (!p) return "";
  return p.length > max ? `${p.slice(0, max)}...` : p;
}

function parseAuditJson(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function looksLikeDateField(fieldName) {
  const k = String(fieldName || "").toLowerCase();
  return k.includes("date") || k.endsWith("_at") || k.endsWith("at");
}

function isDateOnlyField(fieldName) {
  const k = String(fieldName || "").toLowerCase();
  // Business date fields that should not show time.
  return (
    k === "npadate" ||
    k === "entrustmentdate" ||
    k === "date" ||
    k.endsWith("_date")
  );
}

function formatReadableDateTime(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return text;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
}

function formatReadableDateOnly(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return text;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function valueTextForCompare(fieldName, v) {
  if (v == null) return "";
  if (looksLikeDateField(fieldName) && (typeof v === "string" || typeof v === "number")) {
    if (isDateOnlyField(fieldName)) return formatReadableDateOnly(v);
    return formatReadableDateTime(v);
  }
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function buildAuditCompareRows(oldRaw, newRaw) {
  const oldObj = parseAuditJson(oldRaw);
  const newObj = parseAuditJson(newRaw);
  if (!oldObj && !newObj) return [];
  const keys = new Set([
    ...Object.keys(oldObj || {}),
    ...Object.keys(newObj || {})
  ]);
  return [...keys]
    .sort((a, b) => a.localeCompare(b))
    .map((k) => {
      const oldVal = valueTextForCompare(k, oldObj?.[k] ?? "");
      const newVal = valueTextForCompare(k, newObj?.[k] ?? "");
      return { key: k, oldVal, newVal, changed: oldVal !== newVal };
    });
}

function SaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v4h5" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M7 6l1 16h8l1-16" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 18l-4 1 1-4 12.5-11.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function PrintCaseDetailsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 9V2h12v7" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </svg>
  );
}

/**
 * Generic "master" screen:
 * - Entry mode: shows full-width form; Save submits and switches to View.
 * - View mode: shows full-width table with checkbox selection; Edit/Delete act on selected row.
 * - Buttons are RBAC-aware for the configured module key.
 *
 * @param {{ moduleKey: string, isActive?: boolean }} props
 */
export default function MasterModuleClient({ moduleKey, isActive = true }) {
  const config = modules[moduleKey];
  const isReadOnly = Boolean(config?.readOnly);

  const [data, setData] = useState([]);
  const [toast, setToast] = useState(null);

  const [editingRow, setEditingRow] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const formId = `${moduleKey}-form`;

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  const [viewMode, setViewMode] = useState(false);
  // In read-only modules, the entry form is hidden and the UI starts directly in view.
  const effectiveViewMode = isReadOnly ? true : viewMode;
  const [selectedId, setSelectedId] = useState(null);
  // View-mode column filters (one filter input per table column).
  const [viewColumnFilterInput, setViewColumnFilterInput] = useState({});
  const [viewColumnFilters, setViewColumnFilters] = useState({});
  const [permissions, setPermissions] = useState({
    canView: false,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    role: null,
    unit: null
  });
  /** Blocks double-submit and shows full-screen loading overlay during I/O. */
  const [busy, setBusy] = useState(false);
  /** When `modules[moduleKey].postCreateAck` is set and create returns `postCreateAck`, show modal before view. */
  const [postCreateAckOpen, setPostCreateAckOpen] = useState(null);
  /** Audit Logs only: side-by-side old/new compare popup. */
  const [auditCompareDialog, setAuditCompareDialog] = useState(null);

  /** In-memory rows for `config.childTables`, keyed by each child table's `key` (fallback: SQL `table` name). */
  const [childRowsByKey, setChildRowsByKey] = useState(() =>
    emptyChildRowsState(modules[moduleKey]?.childTables)
  );
  const [selectedBranchIdForLoanRule, setSelectedBranchIdForLoanRule] = useState(null);
  const [loanAccountNoDraft, setLoanAccountNoDraft] = useState("");
  const [loanAccountRule, setLoanAccountRule] = useState({
    bankName: "",
    loanAccountNoLength: null
  });

  const title = useMemo(() => config?.label || moduleKey, [config, moduleKey]);

  /** New Case Inward: role 2 (non-admin) uses session unit on new entry only; role 1 picks any unit. */
  const newCaseInwardSessionUnit = useMemo(() => {
    if (moduleKey !== "new_case_inward") return null;
    if (Number(permissions.role) !== 2) return null;
    return permissions.unit;
  }, [moduleKey, permissions.role, permissions.unit]);

  const entryFormInitialValues = useMemo(() => {
    if (editingRow) return editingRow;
    const v = {};
    if (newCaseInwardSessionUnit != null) v.unit = newCaseInwardSessionUnit;
    return v;
  }, [editingRow, newCaseInwardSessionUnit]);

  const entryFormReadOnlyFields = useMemo(() => {
    if (moduleKey !== "new_case_inward" || editingRow) return null;
    if (
      Number(permissions.role) !== 2 ||
      permissions.unit == null ||
      String(permissions.unit).trim() === ""
    ) {
      return null;
    }
    return { unit: true };
  }, [moduleKey, editingRow, permissions.role, permissions.unit]);

  useEffect(() => {
    if (moduleKey !== "new_case_inward") {
      setSelectedBranchIdForLoanRule(null);
      setLoanAccountRule({ bankName: "", loanAccountNoLength: null });
      return;
    }
    const branchRaw = editingRow ? editingRow?.branch : entryFormInitialValues?.branch;
    const branchNum = Number(branchRaw);
    setSelectedBranchIdForLoanRule(Number.isFinite(branchNum) ? branchNum : null);
    const loanNoRaw = editingRow ? editingRow?.loanAccountNo : entryFormInitialValues?.loanAccountNo;
    setLoanAccountNoDraft(String(loanNoRaw ?? ""));
  }, [moduleKey, editingRow, entryFormInitialValues]);

  useEffect(() => {
    if (moduleKey !== "new_case_inward") return;
    const branchId = Number(selectedBranchIdForLoanRule);
    if (!Number.isFinite(branchId)) {
      setLoanAccountRule({ bankName: "", loanAccountNoLength: null });
      return;
    }
    let cancelled = false;
    async function loadRule() {
      try {
        const res = await fetch(`/api/new-case-inward/loan-account-rule?branchId=${branchId}`);
        const payload = await res.json();
        if (cancelled) return;
        const len = Number(payload?.loanAccountNoLength);
        setLoanAccountRule({
          bankName: String(payload?.bankName ?? "").trim(),
          loanAccountNoLength: Number.isFinite(len) && len > 0 ? len : null
        });
      } catch {
        if (!cancelled) setLoanAccountRule({ bankName: "", loanAccountNoLength: null });
      }
    }
    loadRule();
    return () => {
      cancelled = true;
    };
  }, [moduleKey, selectedBranchIdForLoanRule]);

  const entryFieldUiOverrides = useMemo(() => {
    if (moduleKey !== "new_case_inward") return null;
    const len = Number(loanAccountRule.loanAccountNoLength);
    const hasRule = Number.isFinite(len) && len > 0;
    if (!hasRule) {
      return { loanAccountNo: { placeholder: "Enter Loan Account No" } };
    }
    const currentLen = String(loanAccountNoDraft ?? "").trim().length;
    const mismatch = currentLen !== len;
    const bank = String(loanAccountRule.bankName || "").trim();
    const bankSuffix = bank ? ` for ${bank}` : "";
    return {
      loanAccountNo: {
        placeholder: `Enter ${len}-character Loan Account No`,
        maxLength: len,
        helperText: mismatch ? `Required length${bankSuffix}: ${len} characters` : "",
        helperTone: "error"
      }
    };
  }, [moduleKey, loanAccountRule, loanAccountNoDraft]);

  const entryModeConfig = useMemo(() => {
    if (!config) return config;
    if (moduleKey !== "new_case_inward" || editingRow) return config;
    const hiddenOnNew = new Set(["caseStatus", "caseStatusRemarks"]);
    return {
      ...config,
      fields: (config.fields || []).filter((f) => !hiddenOnNew.has(f.name))
    };
  }, [config, moduleKey, editingRow]);

  const showEntryChildTables = useMemo(() => {
    if (!config?.childTables?.length) return false;
    if (moduleKey === "new_case_inward" && !editingRow) return false;
    return true;
  }, [config?.childTables, moduleKey, editingRow]);

  /** Client-side guard; server still enforces RBAC. List rows include `_canEdit` when row-level scope applies. */
  const canSave = useMemo(() => {
    if (config?.readOnly) return false;
    if (editingRow) {
      if (!permissions.canEdit) return false;
      if (editingRow._canEdit === false) return false;
      return true;
    }
    return permissions.canCreate;
  }, [config?.readOnly, editingRow, permissions.canEdit, permissions.canCreate]);

  const canSaveThisRow = !editingRow || editingRow._canEdit !== false;

  const selectedRow = useMemo(() => {
    if (selectedId == null) return null;
    return data.find((r) => String(r.id) === String(selectedId)) ?? null;
  }, [data, selectedId]);

  const canOpenSelectedRecord = useMemo(() => {
    if (!selectedId || !permissions.canEdit || !selectedRow) return false;
    if (selectedRow._canEdit !== false) return true;
    // New Case Inward final-stage rows are view-only for role 2; still allow opening full form data.
    return moduleKey === "new_case_inward";
  }, [selectedId, permissions.canEdit, selectedRow, moduleKey]);

  // View table columns: per-field `showInView` in config/modules.js (default true if omitted).
  const viewFieldConfigs = useMemo(() => {
    return (config?.fields || []).filter((f) => {
      if (f.showInView === false) return false;
      if (moduleKey === "audit_logs" && f.name === "record_id") return false;
      return true;
    });
  }, [config, moduleKey]);
  const auditLogsCompareEnabled = moduleKey === "audit_logs";
  const auditLogsSimpleView = moduleKey === "audit_logs";
  const nciStatusDotEnabled = moduleKey === "new_case_inward";

  const nciCaseStatusField = useMemo(() => {
    if (moduleKey !== "new_case_inward") return null;
    const f = (config?.fields || []).find((x) => x.name === "caseStatus");
    return f && f.type === "lookup" ? f : null;
  }, [moduleKey, config]);

  // Auto-dismiss toast after a short delay.
  useEffect(() => {
    if (!toast) return;
    const timeoutMs = toast.kind === "error" ? 9000 : 3000;
    const t = setTimeout(() => setToast(null), timeoutMs);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    setChildRowsByKey(emptyChildRowsState(config?.childTables));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- new blank grid when form session or module changes only
  }, [formKey, moduleKey]);

  function normalizeToastMessage(kind, message) {
    const text = String(message || "").trim();
    if (kind !== "error") return text;
    if (text.toLowerCase() === "unauthorized") {
      return "Session expired. Please login again.";
    }
    return text;
  }

  function showToast(kind, message) {
    setToast({ kind, message: normalizeToastMessage(kind, message) });
  }

  function handleEntryFieldValueChange(fieldName, value) {
    if (moduleKey !== "new_case_inward") return;
    if (fieldName === "branch") {
      const n = Number(value);
      setSelectedBranchIdForLoanRule(Number.isFinite(n) ? n : null);
      return;
    }
    if (fieldName === "loanAccountNo") {
      setLoanAccountNoDraft(String(value ?? ""));
    }
  }

  const loadRecords = async () => {
    setBusy(true);
    try {
      // Build the same query format used by `/api/crud/[module]`:
      // column filters are `f_<fieldName>` (supported by the API).
      const query = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy: "id",
        sortDir: "desc"
      });

      for (const [fieldName, rawValue] of Object.entries(viewColumnFilters || {})) {
        const value = rawValue == null ? "" : String(rawValue).trim();
        if (!value) continue;
        // Exact filter key format required by the API:
        //   f_<fieldName>  -> exact match (or numeric comparison in server code)
        query.set(`f_${fieldName}`, value);
      }

      const res = await fetch(`/api/crud/${moduleKey}?${query.toString()}`);
      const text = await res.text();
      const payload = text ? JSON.parse(text) : null;
      if (!res.ok) throw new Error(payload?.error || `Failed to load ${moduleKey}`);

      setData(Array.isArray(payload?.data) ? payload.data : []);
      setMeta(
        payload?.meta || { page: 1, limit, total: 0, totalPages: 1, sortBy: "id", sortDir: "desc" }
      );
    } catch (e) {
      showToast("error", e.message || `Failed to load ${moduleKey}`);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!isActive) return;
    if (!config) return;
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, page, limit, viewMode, viewColumnFilters]);

  /**
   * Commit staged inputs to server filters (resets to page 1). Text filters apply on Enter; selects on change.
   * Uses a functional merge so `viewColumnFilterInput` is never stale when combining several columns.
   */
  function commitColumnFilters(mergeFn) {
    setViewColumnFilterInput((prev) => {
      const merged = typeof mergeFn === "function" ? mergeFn(prev) : mergeFn;
      setViewColumnFilters(merged);
      return merged;
    });
    setPage(1);
    setSelectedId(null);
  }

  const hasAnyColumnFilter = useMemo(() => {
    const values = Object.values(viewColumnFilterInput || {});
    // Used to conditionally render "Clear column filters" only when something is actually entered.
    return values.some((v) => String(v ?? "").trim() !== "");
  }, [viewColumnFilterInput]);

  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;

    async function loadPermissions() {
      // Reads RBAC permissions from the server for this module key.
      // This determines whether Edit/Delete buttons should be visible.
      try {
        const res = await fetch(`/api/permissions/${moduleKey}`);
        const text = await res.text();
        const payload = text ? JSON.parse(text) : null;
        if (!res.ok) throw new Error(payload?.error || "Failed to load permissions");
        if (!cancelled && payload) {
          setPermissions({
            canView: Boolean(payload.canView),
            canCreate: Boolean(payload.canCreate),
            canEdit: Boolean(payload.canEdit),
            canDelete: Boolean(payload.canDelete),
            role: payload.role != null ? Number(payload.role) : null,
            unit:
              payload.unit != null && String(payload.unit).trim() !== ""
                ? payload.unit
                : null
          });
        }
      } catch {
        // Default: hide edit/delete when permissions can't be loaded.
      }
    }

    loadPermissions();
    return () => {
      cancelled = true;
    };
  }, [isActive, moduleKey]);

  function handleNew() {
    if (busy) return;
    // "Clear Screen" resets this module back to a fresh entry form.
    setEditingRow(null);
    setFormKey((k) => k + 1);
    setSelectedId(null);
    setViewColumnFilterInput({});
    setViewColumnFilters({});
    setViewMode(false);
    setToast(null);
  }

  function handleViewOnly() {
    if (busy) return;
    // One-way switch: never toggle back to entry via View.
    if (config?.readOnly) return;
    setEditingRow(null);
    setFormKey((k) => k + 1);
    setSelectedId(null);
    setViewColumnFilterInput({});
    setViewColumnFilters({});
    setViewMode(true);
    setToast(null);
  }

  async function handleEditSelected() {
    if (busy) return;
    if (!selectedId) return;
    if (!permissions.canEdit) return;
    const row = data.find((r) => String(r.id) === String(selectedId));
    if (!row) return;
    if (row._canEdit === false && moduleKey !== "new_case_inward") return;

    setBusy(true);
    try {
      const res = await fetch(`/api/crud/${moduleKey}/${selectedId}`);
      const text = await res.text();
      const payload = text ? JSON.parse(text) : null;
      if (!res.ok) throw new Error(payload?.error || "Failed to load record");

      const parent = payload?.data;
      if (!parent) throw new Error("Invalid response");

      setEditingRow(parent);
      if (config?.childTables?.length) {
        setChildRowsByKey(childRowsStateFromApi(config.childTables, payload.childTableRows));
      }
      setSelectedId(null);
      setViewMode(false);
    } catch (err) {
      showToast("error", err.message || "Failed to load record");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSelected() {
    if (!selectedId) return;
    if (!permissions.canDelete) return;
    if (busy) return;
    const row = data.find((r) => String(r.id) === String(selectedId));
    if (!row || row._canDelete === false) return;
    // Confirm and then delete the selected row by its `id`.
    const ok = window.confirm("Delete selected record?");
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/crud/${moduleKey}/${selectedId}`, { method: "DELETE" });
      const text = await res.text();
      const payload = text ? JSON.parse(text) : null;
      if (!res.ok) throw new Error(payload?.error || "Failed to delete record");

      setSelectedId(null);
      await loadRecords();
      setViewMode(true);
      showToast("success", "Record deleted successfully.");
    } catch (err) {
      showToast("error", err.message || "Failed to delete record");
    } finally {
      setBusy(false);
    }
  }

  /** View mode: selected grid row. Entry mode: saved record being edited (`editingRow.id`). */
  const printCaseDetailsTargetId =
    moduleKey === "new_case_inward" && permissions.canView
      ? effectiveViewMode
        ? selectedId
        : editingRow?.id ?? null
      : null;

  async function handlePrintCaseDetails() {
    if (busy) return;
    if (moduleKey !== "new_case_inward" || !permissions.canView) return;
    const id = printCaseDetailsTargetId;
    if (id == null) return;

    setBusy(true);
    try {
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
      const rowForName = effectiveViewMode ? selectedRow : editingRow;
      const caseNo = rowValueForField(rowForName || {}, "caseNo");
      const safe = String(caseNo ?? id)
        .trim()
        .replace(/[/\\?%*:|"<>]/g, "_")
        .replace(/\s+/g, "_")
        .slice(0, 120) || "case";
      const name = `CASE_DETAILS_${safe}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast("error", err.message || "Failed to download PDF");
    } finally {
      setBusy(false);
    }
  }

  function handlePostCreateAckContinue() {
    const ack = postCreateAckOpen;
    setPostCreateAckOpen(null);
    if (!ack) return;
    setEditingRow(null);
    setFormKey((k) => k + 1);
    setSelectedId(ack.id);
    setViewMode(true);
    showToast("success", `${config.label || moduleKey}: saved successfully.`);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!config || busy) return;
    if (!canSave) return;

    if (config.childTables?.length) {
      const childErr = validateChildTableRows(config, childRowsByKey);
      if (childErr) {
        showToast("error", childErr);
        return;
      }
    }

    const form = Object.fromEntries(new FormData(e.target));
    const body = { ...form };
    if (config.childTables?.length) {
      body.childTableRows = stripChildRowsForApi(config.childTables, childRowsByKey);
    }

    if (moduleKey === "new_case_inward") {
      const cs = body.caseStatus;
      const hasCaseStatus =
        cs != null &&
        String(cs).trim() !== "" &&
        Number.isFinite(Number(cs)) &&
        Number(cs) > 0;
      if (hasCaseStatus && String(body.caseStatusRemarks ?? "").trim() === "") {
        showToast("error", "Case Status Remarks is required when Case Status is selected.");
        return;
      }
    }

    setBusy(true);
    try {
      // Create when adding a new record, update when editing an existing one.
      const method = editingRow ? "PUT" : "POST";
      const url = editingRow ? `/api/crud/${moduleKey}/${editingRow.id}` : `/api/crud/${moduleKey}`;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const text = await res.text();
      const payload = text ? JSON.parse(text) : null;
      if (!res.ok) throw new Error(payload?.error || `Failed to save record`);

      const ackCfg = config.postCreateAck;
      const pAck = payload?.postCreateAck;
      const wantsAck =
        !editingRow &&
        ackCfg &&
        pAck?.value != null &&
        String(pAck.value).trim() !== "" &&
        (!pAck.field || !ackCfg.field || pAck.field === ackCfg.field);

      if (wantsAck) {
        setPostCreateAckOpen({
          id: Number(payload.id),
          value: String(pAck.value).trim(),
          title: ackCfg.title,
          hint: ackCfg.hint,
          showPrintPdf: ackCfg.showPrintPdf === true
        });
        return;
      }

      setEditingRow(null);
      setFormKey((k) => k + 1);
      setSelectedId(null);
      setViewMode(true);
      showToast("success", `${config.label || moduleKey}: saved successfully.`);
    } catch (err) {
      showToast("error", err.message || "Failed to save record");
    } finally {
      setBusy(false);
    }
  }

  if (!config) {
    return (
      <div className="card">
        <h1>{moduleKey}</h1>
        <p>Module not configured. Add it in config/modules.js.</p>
      </div>
    );
  }

  return (
    <div className="master-module-page">
      <PostCreateAckModal
        open={postCreateAckOpen != null}
        value={postCreateAckOpen?.value}
        title={postCreateAckOpen?.title}
        hint={postCreateAckOpen?.hint}
        showPrintPdf={postCreateAckOpen?.showPrintPdf}
        recordId={postCreateAckOpen?.id}
        onContinue={handlePostCreateAckContinue}
      />
      <LoadingOverlay busy={busy} />

      <div className="master-module-header">
        <h1 className="module-page-title">{title}</h1>
        <div className="master-module-header-actions">
          <MasterActionsMenu
            formId={formId}
            busy={busy}
            readOnly={config.readOnly}
            entryMode={!effectiveViewMode}
            editingRow={Boolean(editingRow)}
            canCreate={permissions.canCreate}
            canEdit={permissions.canEdit}
            canSaveThisRow={canSaveThisRow}
            canView={permissions.canView}
            onView={handleViewOnly}
            onClear={handleNew}
          />
        </div>
      </div>

      <ToastNotice toast={toast} onClose={() => setToast(null)} />
      {auditCompareDialog ? (
        <div
          className="audit-json-modal-backdrop"
          role="presentation"
          onClick={() => setAuditCompareDialog(null)}
        >
          <div
            className="audit-json-modal"
            role="dialog"
            aria-modal="true"
            aria-label={auditCompareDialog.title || "Audit compare"}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="audit-json-modal-header">
              <h3 className="audit-json-modal-title">{auditCompareDialog.title}</h3>
              <button
                type="button"
                className="audit-json-modal-close"
                onClick={() => setAuditCompareDialog(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="audit-compare-legend" role="note" aria-label="Compare legend">
              <span className="audit-compare-legend-dot" aria-hidden />
              Highlighted rows indicate changed values.
            </div>
            {buildAuditCompareRows(auditCompareDialog.oldRaw, auditCompareDialog.newRaw).length ? (
              <div className="audit-compare-table-wrap">
                <table className="audit-compare-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Old Data</th>
                      <th>New Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildAuditCompareRows(auditCompareDialog.oldRaw, auditCompareDialog.newRaw).map((row) => (
                      <tr key={row.key} className={row.changed ? "audit-compare-row-changed" : undefined}>
                        <td>{row.key}</td>
                        <td>{row.oldVal || "—"}</td>
                        <td>{row.newVal || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="audit-json-modal-split">
                <div>
                  <h4>Old Data</h4>
                  <pre className="audit-json-modal-pre">
                    {prettyAuditJsonText(auditCompareDialog.oldRaw) || "—"}
                  </pre>
                </div>
                <div>
                  <h4>New Data</h4>
                  <pre className="audit-json-modal-pre">
                    {prettyAuditJsonText(auditCompareDialog.newRaw) || "—"}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {!effectiveViewMode ? (
        <>
          {/* Entry mode: show the dynamic form for create/update. */}
          <DynamicForm
            key={`${formKey}-${editingRow ? `edit-${editingRow.id}` : "new"}`}
            config={entryModeConfig}
            onSubmit={handleSubmit}
            initialValues={entryFormInitialValues}
            readOnlyFields={entryFormReadOnlyFields}
            fieldUiOverrides={entryFieldUiOverrides}
            onFieldValueChange={handleEntryFieldValueChange}
            submitLabel="Save"
            hideButtons
            formId={formId}
            className="card master-entry-form"
            formGridClassName="form-grid form-grid-master"
          />
          {showEntryChildTables ? (
            <ModuleChildTablesPanel
              childTables={config.childTables}
              value={childRowsByKey}
              onChange={setChildRowsByKey}
              disabled={busy}
              onNotify={(kind, message) => showToast(kind, message)}
            />
          ) : null}
        </>
      ) : (
        // View mode: show a table with per-column filters + checkbox selection.
        <div className="card table-section">
          <p className="table-scroll-hint" role="note">
            Swipe or scroll sideways to see all columns.
          </p>
          <div className="table-wrap master-orders-table-wrap">
            <table className="data-table data-table-compact master-orders-table">
              <thead>
                <tr>
                  {!auditLogsSimpleView ? (
                    <th className="master-select-col" scope="col">
                      ✔️
                    </th>
                  ) : null}
                  {nciStatusDotEnabled ? <th className="master-status-dot-col">Status</th> : null}
                  {viewFieldConfigs.map((f) => (
                    <th key={f.name}>{f.label || f.name}</th>
                  ))}
                  {auditLogsCompareEnabled ? <th className="audit-compare-col">Compare</th> : null}
                </tr>
                <tr>
                  {!auditLogsSimpleView ? (
                    <th className="master-filter-th" aria-hidden>
                      {/* selection column has no filter */}
                    </th>
                  ) : null}
                  {nciStatusDotEnabled ? <th className="master-filter-th" aria-hidden /> : null}
                  {viewFieldConfigs.map((f) => {
                    // Per-column filter input.
                    // Values are sent to the server as `f_<fieldName>` and applied server-side.
                    const value = viewColumnFilterInput?.[f.name] ?? "";
                    const onChangeValue = (next) =>
                      setViewColumnFilterInput((prev) => ({ ...prev, [f.name]: next }));

                    if (f.type === "select" && Array.isArray(f.options)) {
                      return (
                        <th key={f.name} className="master-filter-th">
                          <select
                            className="master-col-filter-input"
                            value={value}
                            onChange={(e) => {
                              const next = e.target.value;
                              commitColumnFilters((prev) => ({ ...prev, [f.name]: next }));
                            }}
                            aria-label={`Filter ${f.label}`}
                          >
                            <option value="">All</option>
                            {f.options.map((opt) => (
                              <option key={String(opt.value)} value={String(opt.value)}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </th>
                      );
                    }

                    const inputType = f.type === "number" ? "number" : "text";
                    const filterPlaceholder = f.type === "date" ? "dd-mm-yyyy" : "";
                    const filterTitle =
                      f.type === "date"
                        ? "Type dd-mm-yyyy or yyyy-mm-dd, then Enter"
                        : "Press Enter to apply filter";

                    return (
                      <th key={f.name} className="master-filter-th">
                        <input
                          className="master-col-filter-input"
                          value={value}
                          type={inputType}
                          onChange={(e) => onChangeValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            e.preventDefault();
                            // Read value here — React may null `e.currentTarget` before the setState updater runs.
                            const nextVal = e.currentTarget.value;
                            commitColumnFilters((prev) => ({
                              ...prev,
                              [f.name]: nextVal
                            }));
                          }}
                          placeholder={filterPlaceholder}
                          title={filterTitle}
                          aria-label={`Filter ${f.label}`}
                        />
                      </th>
                    );
                  })}
                  {auditLogsCompareEnabled ? <th className="master-filter-th" aria-hidden /> : null}
                </tr>
              </thead>
              <tbody>
                {data.map((r) => {
                  const isChecked = selectedId != null && String(r.id) === String(selectedId);
                  const nciDotTone =
                    nciCaseStatusField != null
                      ? getNewCaseInwardStatusDotTone(
                          rowValueForField(r, getLookupRowLabelKey(nciCaseStatusField)) ??
                            rowValueForField(r, "caseStatus") ??
                            ""
                        )
                      : null;
                  const trClass = [isChecked && "master-row-selected"].filter(Boolean).join(" ");
                  return (
                    <tr key={r.id} className={trClass || undefined}>
                      {!auditLogsSimpleView ? (
                        <td className="master-select-col">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            // Only one row can be selected at a time; clicking again clears selection.
                            onChange={() => setSelectedId(isChecked ? null : r.id)}
                            aria-label={`Select ${moduleKey} ${r.id}`}
                          />
                        </td>
                      ) : null}
                      {nciStatusDotEnabled ? (
                        <td className="master-status-dot-col">
                          <span
                            className={`master-status-dot master-status-dot--${nciDotTone || "ongoing"}`}
                            title={
                              nciDotTone === "returned"
                                ? "Returned case"
                                : nciDotTone === "final"
                                  ? "Final stage case"
                                  : "Ongoing case"
                            }
                            aria-label={
                              nciDotTone === "returned"
                                ? "Returned case"
                                : nciDotTone === "final"
                                  ? "Final stage case"
                                  : "Ongoing case"
                            }
                          />
                        </td>
                      ) : null}
                      {viewFieldConfigs.map((f) => (
                        <td key={f.name}>
                          {/* rowValueForField: MySQL may return column names in different casing than config. */}
                          {moduleKey === "audit_logs" && (f.name === "old_data" || f.name === "new_data") ? (
                            (() => {
                              const raw = rowValueForField(r, f.name);
                              const preview = auditJsonPreview(raw);
                              return preview ? (
                                <span className="audit-json-preview">{preview}</span>
                              ) : (
                                "—"
                              );
                            })()
                          ) : moduleKey === "audit_logs" && f.name === "created_at" ? (
                            (() => {
                              const raw = rowValueForField(r, f.name);
                              const d = raw ? new Date(raw) : null;
                              if (!d || Number.isNaN(d.getTime())) return raw ? String(raw) : "";
                              const dd = String(d.getDate()).padStart(2, "0");
                              const mm = String(d.getMonth() + 1).padStart(2, "0");
                              const yyyy = d.getFullYear();
                              const hh = String(d.getHours()).padStart(2, "0");
                              const min = String(d.getMinutes()).padStart(2, "0");
                              return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
                            })()
                          ) : f.type === "lookup" ? (
                            rowValueForField(r, getLookupRowLabelKey(f)) ??
                            rowValueForField(r, f.name) ??
                            ""
                          ) : (
                            formatViewCellValue(f, rowValueForField(r, f.name))
                          )}
                        </td>
                      ))}
                      {auditLogsCompareEnabled ? (
                        <td className="audit-compare-col">
                          <button
                            type="button"
                            className="audit-json-open"
                            onClick={() =>
                              setAuditCompareDialog({
                                title: `Record ${rowValueForField(r, "id") || ""} — Old vs New`,
                                oldRaw: rowValueForField(r, "old_data"),
                                newRaw: rowValueForField(r, "new_data")
                              })
                            }
                          >
                            Compare
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <PaginationBar
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={limit}
            onPageChange={(p) => {
              setPage(p);
              setSelectedId(null);
            }}
            onLimitChange={(n) => {
              setPage(1);
              setLimit(n);
              setSelectedId(null);
            }}
            leftExtra={
              hasAnyColumnFilter ? (
                // Clear column filters button placed next to the "Showing X–Y of Z" summary.
                <button
                  type="button"
                  className="master-btn master-btn-warning"
                  onClick={() => {
                    setViewColumnFilterInput({});
                    setViewColumnFilters({});
                    setSelectedId(null);
                    setPage(1);
                  }}
                  title="Clear column filters"
                >
                  <ClearIcon />
                  Clear
                </button>
              ) : null
            }
          />

          {!auditLogsSimpleView ? (
            <div className="master-view-actions">
              <div className="master-view-actions-left">
                {canOpenSelectedRecord ? (
                  <button
                    type="button"
                    className="master-btn master-btn-primary"
                    onClick={handleEditSelected}
                    title={selectedRow?._canEdit === false ? "View full record" : "Edit record"}
                    disabled={busy}
                  >
                    <EditIcon />
                    {selectedRow?._canEdit === false ? "View record" : "Edit record"}
                  </button>
                ) : null}
                {selectedId && permissions.canDelete && selectedRow?._canDelete !== false ? (
                  <button
                    type="button"
                    className="master-btn master-btn-danger"
                    onClick={handleDeleteSelected}
                    title="Delete record"
                    disabled={busy}
                  >
                    <TrashIcon />
                    Delete record
                  </button>
                ) : null}
                {printCaseDetailsTargetId != null ? (
                  <button
                    type="button"
                    onClick={handlePrintCaseDetails}
                    title="Download PDF with parent and line-item details"
                    className="master-btn master-btn-outline"
                    disabled={busy}
                  >
                    <PrintCaseDetailsIcon />
                    Print Case Details
                  </button>
                ) : null}
              </div>
              <div className="master-view-actions-right">
                <button
                  type="button"
                  onClick={handleNew}
                  title="Clear screen"
                  className="master-btn master-btn-warning"
                  disabled={busy}
                >
                  <ClearIcon />
                  Clear Screen
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {!effectiveViewMode ? (
        <div className="master-actions-bottom">
          <div className="master-actions-right">
            {canSave ? (
              <button form={formId} type="submit" className="master-btn master-btn-primary" disabled={busy}>
                <SaveIcon />
                Save
              </button>
            ) : null}
            {!config.readOnly && permissions.canView ? (
              <button
                type="button"
                onClick={handleViewOnly}
                disabled={busy}
                title="View saved data"
                className="master-btn master-btn-info"
              >
                <EyeIcon />
                View
              </button>
            ) : null}
            {printCaseDetailsTargetId != null ? (
              <button
                type="button"
                onClick={handlePrintCaseDetails}
                title="Download PDF with parent and line-item details"
                className="master-btn master-btn-outline"
                disabled={busy}
              >
                <PrintCaseDetailsIcon />
                Print Case Details
              </button>
            ) : null}
            <button type="button" onClick={handleNew} title="Clear screen" className="master-btn master-btn-warning" disabled={busy}>
              <ClearIcon />
              Clear Screen
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

