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

  /** In-memory rows for `config.childTables`, keyed by each child table's `key` (fallback: SQL `table` name). */
  const [childRowsByKey, setChildRowsByKey] = useState(() =>
    emptyChildRowsState(modules[moduleKey]?.childTables)
  );

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

  // View table columns: per-field `showInView` in config/modules.js (default true if omitted).
  const viewFieldConfigs = useMemo(() => {
    return (config?.fields || []).filter((f) => f.showInView !== false);
  }, [config]);

  // Auto-dismiss toast after a short delay.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    setChildRowsByKey(emptyChildRowsState(config?.childTables));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- new blank grid when form session or module changes only
  }, [formKey, moduleKey]);

  function showToast(kind, message) {
    setToast({ kind, message: String(message || "") });
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
    if (!row || row._canEdit === false) return;

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

      {!effectiveViewMode ? (
        <>
          {/* Entry mode: show the dynamic form for create/update. */}
          <DynamicForm
            key={`${formKey}-${editingRow ? `edit-${editingRow.id}` : "new"}`}
            config={config}
            onSubmit={handleSubmit}
            initialValues={entryFormInitialValues}
            readOnlyFields={entryFormReadOnlyFields}
            submitLabel="Save"
            hideButtons
            formId={formId}
            className="card master-entry-form"
            formGridClassName="form-grid form-grid-master"
          />
          <ModuleChildTablesPanel
            childTables={config.childTables}
            value={childRowsByKey}
            onChange={setChildRowsByKey}
            disabled={busy}
            onNotify={(kind, message) => showToast(kind, message)}
          />
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
                  <th className="master-select-col" scope="col">
                    ✔️
                  </th>
                  {viewFieldConfigs.map((f) => (
                    <th key={f.name}>{labelWithRequiredMark(f.label, Boolean(f.required))}</th>
                  ))}
                </tr>
                <tr>
                  <th className="master-filter-th" aria-hidden>
                    {/* selection column has no filter */}
                  </th>
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
                </tr>
              </thead>
              <tbody>
                {data.map((r) => {
                  const isChecked = selectedId != null && String(r.id) === String(selectedId);
                  return (
                    <tr key={r.id} className={isChecked ? "master-row-selected" : undefined}>
                      <td className="master-select-col">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          // Only one row can be selected at a time; clicking again clears selection.
                          onChange={() => setSelectedId(isChecked ? null : r.id)}
                          aria-label={`Select ${moduleKey} ${r.id}`}
                        />
                      </td>
                      {viewFieldConfigs.map((f) => (
                        <td key={f.name}>
                          {/* rowValueForField: MySQL may return column names in different casing than config. */}
                          {f.type === "lookup"
                            ? rowValueForField(r, getLookupRowLabelKey(f)) ??
                              rowValueForField(r, f.name) ??
                              ""
                            : formatViewCellValue(f, rowValueForField(r, f.name))}
                        </td>
                      ))}
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

          <div className="master-view-actions">
            <div className="master-view-actions-left">
              {selectedId && permissions.canEdit && selectedRow?._canEdit !== false ? (
                <button
                  type="button"
                  className="master-btn master-btn-primary"
                  onClick={handleEditSelected}
                  title="Edit record"
                  disabled={busy}
                >
                  <EditIcon />
                  Edit record
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
            </div>
            <button
              type="button"
              onClick={handleNew}
              title="Clear screen"
              className="master-btn master-btn-warning master-view-actions-clear"
              disabled={busy}
            >
              <ClearIcon />
              Clear Screen
            </button>
          </div>
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

