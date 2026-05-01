"use client";

/**
 * Line-item grids under the main master form (`childTables` in config).
 * Uses the same table + button styling as the master module (master-orders-table, master-btn).
 *
 * IMPORTANT ARCHITECTURE RULE (layman):
 * - This is a reusable child-table engine.
 * - Keep module-specific business checks out of this file.
 * - Use field config (`requiredWhenChecked`, types, labels) and module adapters instead.
 */
import { useEffect, useMemo, useState } from "react";
import { formatViewCellValue } from "../lib/formatViewCellValue";
import { rowValueForField } from "../lib/gridRowValue";
import { getYmdISTFromInstant } from "../lib/istDateTime";
import { formatLookupRowLabel, resolveLookupLabelFieldName } from "../lib/lookupLabelField";
import { appendLookupValueMasterLovParams } from "../lib/lookupLovQueryParams";
import { toYyyyMmDdForSqlDateField } from "../lib/sqlDateFieldValue";
import InrNumberInput from "./InrNumberInput";

function newRowId() {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * @param {{ fields?: Array<{ name: string, type?: string }> } | null | undefined} [ct] — optional child-table config for defaults (e.g. checkbox → 0).
 */
export function newChildRowDraft(ct) {
  const draft = {
    _rowId: newRowId(),
    _editing: true,
    _lineSaved: false
  };
  for (const f of ct?.fields || []) {
    if (f.type === "checkbox") draft[f.name] = 0;
  }
  return draft;
}

function validateRowFields(ct, row) {
  const fields = ct.fields || [];
  for (const f of fields) {
    if (!f.required) continue;
    const v = row[f.name];
    const empty = v === null || v === undefined || (typeof v === "string" && !String(v).trim());
    if (empty) {
      return `${f.label || f.name} is required.`;
    }
    if (f.type === "number") {
      const n = Number(v);
      if (!Number.isFinite(n)) {
        return `${f.label || f.name} must be a valid number.`;
      }
    }
    if (f.type === "checkbox") {
      const n = v === true ? 1 : v === false ? 0 : Number(v);
      if (n !== 0 && n !== 1) {
        return `${f.label || f.name} must be checked or unchecked (0/1).`;
      }
    }
  }
  for (const dep of fields) {
    const rwc = dep.requiredWhenChecked;
    if (!rwc?.checkboxField) continue;
    const cbName = rwc.checkboxField;
    const cv = row[cbName];
    const checked =
      cv === true || Number(cv) === 1 || (typeof cv === "string" && String(cv).trim() === "1");
    if (!checked) continue;
    const v = row[dep.name];
    const empty = v === null || v === undefined || (typeof v === "string" && !String(v).trim());
    if (empty) {
      const cb = fields.find((x) => x.name === cbName);
      return `${dep.label || dep.name} is required when ${cb?.label || cbName} is selected.`;
    }
  }
  return null;
}

function inputPlaceholder(f) {
  if (f.placeholder) return String(f.placeholder);
  if (f.type === "date") return "Date";
  if (f.type === "number") return "Amount";
  return "";
}

/** Width for actions when `actionsColumnWidth` omitted: four 32px icons + gaps in one row (no wrap). */
const DEFAULT_ACTIONS_COLUMN_WIDTH = "11.25rem";

function fieldColumnWidth(f) {
  if (f.columnWidth != null && String(f.columnWidth).trim() !== "") return String(f.columnWidth).trim();
  if (f.type === "date") return "11rem";
  if (f.type === "number") return "9rem";
  if (f.type === "checkbox") return "4.5rem";
  return "10rem";
}

function toNumberOrZero(value) {
  const n = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function formatLookupReadonlyValue(tableKey, field, row, lookupOptionsByField) {
  const value = rowValueForField(row, field.name);
  if (value == null || String(value).trim() === "") return "";
  const options = lookupOptionsByField?.[`${tableKey}:${field.name}`] || [];
  const vf = String(field?.lookup?.valueField || "id").trim();
  const match = options.find((opt) => String(opt?.[vf]) === String(value));
  if (!match) return String(value);
  return formatLookupRowLabel(match, field.lookup) || String(value);
}

function formatInrAmount(value) {
  const amount = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value || 0);
  return `₹ ${amount}`;
}

/**
 * Column widths for `<colgroup>`: index, each field from `columnWidth` / type defaults, then actions.
 * Drives `table-layout: fixed` so total table width matches the sum of configured columns.
 */
function childTableColumnWidths(ct, fields) {
  const indexW = String(ct.indexColumnWidth || "2.25rem").trim();
  const fieldWs = fields.map((f) => fieldColumnWidth(f));
  const actionsW =
    ct.actionsColumnWidth != null && String(ct.actionsColumnWidth).trim() !== ""
      ? String(ct.actionsColumnWidth).trim()
      : DEFAULT_ACTIONS_COLUMN_WIDTH;
  return [indexW, ...fieldWs, actionsW];
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

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/**
 * @param {{
 *   childTables: Array<{
 *     key?: string,
 *     table: string,
 *     label?: string,
 *     indexColumnWidth?: string,
 *     actionsColumnWidth?: string,
 *     fields?: Array<{
 *       name: string,
 *       type?: string,
 *       label?: string,
 *       required?: boolean,
 *       placeholder?: string,
 *       columnWidth?: string
 *     }>
 *   }>,
 *   value: Record<string, Array<Record<string, unknown>>>,
 *   onChange: (next: Record<string, Array<Record<string, unknown>>>) => void,
 *   childFieldUiOverrides?: Record<string, Record<string, { helperText?: string, min?: string }>>,
 *   disabled?: boolean,
 *   onNotify?: (kind: "success" | "error", message: string) => void
 * }} props
 */
export default function ModuleChildTablesPanel({
  childTables,
  value,
  onChange,
  childFieldUiOverrides = null,
  disabled = false,
  onNotify
}) {
  if (!childTables?.length) return null;
  // Child date fields with `maxToday` use IST date so UI and server stay aligned.
  const todayYmd = getYmdISTFromInstant(new Date());
  const [lookupOptionsByField, setLookupOptionsByField] = useState({});

  const lookupFieldDefs = useMemo(() => {
    const defs = [];
    for (const ct of childTables || []) {
      const tableKey = ct.key || ct.table;
      for (const f of ct.fields || []) {
        if (f.type === "lookup" && f.lookup?.module) defs.push({ tableKey, field: f });
      }
    }
    return defs;
  }, [childTables]);

  useEffect(() => {
    let cancelled = false;
    async function loadChildLookupOptions() {
      const next = {};
      for (const def of lookupFieldDefs) {
        const tableKey = def.tableKey;
        const f = def.field;
        const lookup = f.lookup || {};
        const labelField =
          resolveLookupLabelFieldName(lookup) || String(lookup?.valueField ?? "").trim() || "id";
        const key = `${tableKey}:${f.name}`;
        try {
          const q = new URLSearchParams({
            page: "1",
            limit: "500",
            search: "",
            sortBy: labelField || "id",
            sortDir: "asc",
            lov: "1"
          });
          appendLookupValueMasterLovParams(q, lookup);
          const res = await fetch(`/api/crud/${lookup.module}?${q.toString()}`);
          const json = await res.json();
          next[key] = Array.isArray(json?.data) ? json.data : [];
        } catch {
          next[key] = [];
        }
      }
      if (!cancelled) setLookupOptionsByField(next);
    }
    loadChildLookupOptions();
    return () => {
      cancelled = true;
    };
  }, [lookupFieldDefs]);

  function setRows(tableKey, rows) {
    onChange({ ...value, [tableKey]: rows });
  }

  function notify(kind, message) {
    if (onNotify) onNotify(kind, message);
  }

  function handleSaveLine(ct, tableKey, index) {
    const rows = [...(value[tableKey] || [])];
    const row = rows[index];
    if (!row) return;
    const err = validateRowFields(ct, row);
    if (err) {
      notify("error", `${ct.label || tableKey}: ${err}`);
      return;
    }
    // Mark line as committed so parent save accepts it.
    rows[index] = { ...row, _lineSaved: true, _editing: false };
    setRows(tableKey, rows);
  }

  function handleEditLine(tableKey, index) {
    const rows = [...(value[tableKey] || [])];
    const row = rows[index];
    if (!row) return;
    // Re-open line and mark unsaved until user clicks row Save again.
    rows[index] = { ...row, _editing: true, _lineSaved: false };
    setRows(tableKey, rows);
  }

  function handleDeleteLine(tableKey, index) {
    const rows = [...(value[tableKey] || [])];
    rows.splice(index, 1);
    if (rows.length === 0) {
      setRows(tableKey, [newChildRowDraft(ctByKey(tableKey))]);
    } else {
      setRows(tableKey, rows);
    }
  }

  function handleInsertRowAfter(tableKey, index) {
    const rows = [...(value[tableKey] || [])];
    const maxRows = Number(ctByKey(tableKey)?.maxRows);
    if (Number.isFinite(maxRows) && maxRows > 0 && rows.length >= maxRows) {
      notify("error", `${ctByKey(tableKey)?.label || tableKey}: maximum ${maxRows} rows are allowed.`);
      return;
    }
    // Insert a fresh editable row right below current line.
    rows.splice(index + 1, 0, newChildRowDraft(ctByKey(tableKey)));
    setRows(tableKey, rows);
  }

  function ctByKey(tableKey) {
    return (childTables || []).find((ct) => (ct.key || ct.table) === tableKey) || null;
  }

  return (
    <div className="module-child-tables">
      {childTables.map((ct) => {
        const tableKey = ct.key || ct.table;
        const rows = value[tableKey] || [];
        const fields = ct.fields || [];
        const helperMessages = Object.values(childFieldUiOverrides?.[tableKey] || {})
          .map((v) => String(v?.helperText || "").trim())
          .filter(Boolean);
        const colWidths = childTableColumnWidths(ct, fields);
        const numericFieldTotals = fields.reduce((acc, f) => {
          if (f.type !== "number") return acc;
          acc[f.name] = rows.reduce((sum, row) => sum + toNumberOrZero(row?.[f.name]), 0);
          return acc;
        }, {});

        return (
          <div key={tableKey} className="card table-section module-child-card">
            <h2 className="module-child-section-title">{ct.label || ct.table}</h2>
            <p className="table-scroll-hint" role="note">
              Save each line with <strong>Save</strong> before saving the main form. Scroll sideways if columns do not fit.
            </p>
            <div className="table-wrap master-orders-table-wrap master-child-table-wrap">
              <table className="data-table data-table-compact master-orders-table master-child-table">
                <colgroup>
                  {colWidths.map((w, i) => (
                    <col key={i} style={{ width: w }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th className="master-child-idx-col" scope="col">
                      #
                    </th>
                    {fields.map((f) => (
                      <th
                        key={f.name}
                        className={`master-child-field-col${f.type === "number" ? " master-child-number-col" : ""}`}
                      >
                        {f.label || f.name}
                        {f.required ? (
                          <span className="form-required-mark" aria-hidden="true" title="Required">
                            {" *"}
                          </span>
                        ) : null}
                      </th>
                    ))}
                    <th className="data-table-actions-col master-child-actions-col" scope="col">
                      <span className="sr-only">Row actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const isEditing = Boolean(row._editing);
                    const isSaved = Boolean(row._lineSaved);
                    const inputsDisabled = disabled || !isEditing;
                    return (
                      <tr key={String(row._rowId ?? index)}>
                        <td className="master-child-idx-col">{index + 1}</td>
                        {fields.map((f) => (
                          <td
                            key={f.name}
                            className={`master-child-field-col${f.type === "number" ? " master-child-number-col" : ""}`}
                          >
                            {(() => {
                              const ui = childFieldUiOverrides?.[tableKey]?.[f.name] || {};
                              const hasUiMin = Object.prototype.hasOwnProperty.call(ui, "min");
                              const hasUiMax = Object.prototype.hasOwnProperty.call(ui, "max");
                              return f.type === "checkbox" ? (
                                <input
                                  type="checkbox"
                                  className="master-inline-checkbox"
                                  checked={
                                    Boolean(row[f.name]) === true ||
                                    Number(row[f.name]) === 1 ||
                                    String(row[f.name]).trim() === "1"
                                  }
                                  disabled={disabled}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      for (const dep of fields) {
                                        if (dep.requiredWhenChecked?.checkboxField !== f.name) continue;
                                        const need = String(row[dep.name] ?? "").trim();
                                        if (!need) {
                                          notify(
                                            "error",
                                            `${ct.label || tableKey}: enter ${dep.label || dep.name} before selecting this row.`
                                          );
                                          return;
                                        }
                                      }
                                    }
                                    const next = [...(value[tableKey] || [])];
                                    const prev = next[index] || {};
                                    // Allow quick select/unselect without forcing row edit mode.
                                    next[index] = {
                                      ...prev,
                                      [f.name]: e.target.checked ? 1 : 0,
                                      _lineSaved: true,
                                      _editing: false
                                    };
                                    setRows(tableKey, next);
                                  }}
                                  aria-label={f.label || f.name}
                                />
                              ) : isEditing ? (
                                f.type === "date" ? (
                                  <>
                                    <input
                                      className="master-inline-input"
                                      type="date"
                                      placeholder={inputPlaceholder(f)}
                                      value={
                                        row[f.name] != null && row[f.name] !== ""
                                          ? toYyyyMmDdForSqlDateField(row[f.name])
                                          : ""
                                      }
                                      disabled={inputsDisabled}
                                      min={
                                        hasUiMin
                                          ? ui.min != null && String(ui.min).trim() !== ""
                                            ? String(ui.min).trim()
                                            : undefined
                                          : undefined
                                      }
                                      max={
                                        hasUiMax
                                          ? ui.max != null && String(ui.max).trim() !== ""
                                            ? String(ui.max).trim()
                                            : undefined
                                          : f.maxToday
                                            ? todayYmd
                                            : undefined
                                      }
                                      onChange={(e) => {
                                        // Some browsers let users click out-of-range dates in picker UI.
                                        // Clamp immediately so min/max rules are always enforced on screen.
                                        const min = hasUiMin
                                          ? ui.min != null && String(ui.min).trim() !== ""
                                            ? String(ui.min).trim()
                                            : undefined
                                          : undefined;
                                        const max = hasUiMax
                                          ? ui.max != null && String(ui.max).trim() !== ""
                                            ? String(ui.max).trim()
                                            : undefined
                                          : f.maxToday
                                            ? todayYmd
                                            : undefined;
                                        let nextValue = e.target.value;
                                        if (nextValue && min && nextValue < min) {
                                          nextValue = min;
                                          e.target.value = nextValue;
                                        } else if (nextValue && max && nextValue > max) {
                                          nextValue = max;
                                          e.target.value = nextValue;
                                        }
                                        const next = [...(value[tableKey] || [])];
                                        const prev = next[index] || {};
                                        next[index] = { ...prev, [f.name]: nextValue, _lineSaved: false };
                                        setRows(tableKey, next);
                                      }}
                                      aria-label={f.label || f.name}
                                    />
                                  </>
                                ) : f.type === "number" ? (
                                  <InrNumberInput
                                    id={`${tableKey}-${f.name}-${index}`}
                                    defaultValue={row[f.name] ?? ""}
                                    disabled={inputsDisabled}
                                    className="master-inline-input master-inline-input-number"
                                    placeholder={inputPlaceholder(f)}
                                    ariaLabel={f.label || f.name}
                                    onRawValueChange={(nextRawValue) => {
                                      const next = [...(value[tableKey] || [])];
                                      const prev = next[index] || {};
                                      next[index] = { ...prev, [f.name]: nextRawValue, _lineSaved: false };
                                      setRows(tableKey, next);
                                    }}
                                  />
                                ) : f.type === "lookup" && f.lookup ? (
                                  <select
                                    className="master-inline-input"
                                    value={row[f.name] == null || row[f.name] === "" ? "" : String(row[f.name])}
                                    disabled={inputsDisabled}
                                    onChange={(e) => {
                                      const next = [...(value[tableKey] || [])];
                                      const prev = next[index] || {};
                                      next[index] = { ...prev, [f.name]: e.target.value, _lineSaved: false };
                                      setRows(tableKey, next);
                                    }}
                                    aria-label={f.label || f.name}
                                  >
                                    <option value="">Select…</option>
                                    {(lookupOptionsByField[`${tableKey}:${f.name}`] || []).map((optRow) => {
                                      const vf = String(f.lookup.valueField || "id");
                                      const v = optRow?.[vf];
                                      if (v == null || v === "") return null;
                                      const optionKey = String(v);
                                      return (
                                        <option key={optionKey} value={optionKey}>
                                          {formatLookupRowLabel(optRow, f.lookup) || optionKey}
                                        </option>
                                      );
                                    })}
                                  </select>
                                ) : f.type === "textarea" ||
                                    (f.type === "text" && Number.isFinite(Number(f.rows)) && Number(f.rows) > 1) ? (
                                  <textarea
                                    className="master-inline-input master-inline-textarea"
                                    rows={Math.max(2, Number(f.rows) || 3)}
                                    placeholder={inputPlaceholder(f)}
                                    value={row[f.name] == null || row[f.name] === "" ? "" : String(row[f.name])}
                                    disabled={inputsDisabled}
                                    onChange={(e) => {
                                      const next = [...(value[tableKey] || [])];
                                      const prev = next[index] || {};
                                      next[index] = { ...prev, [f.name]: e.target.value, _lineSaved: false };
                                      setRows(tableKey, next);
                                    }}
                                    aria-label={f.label || f.name}
                                  />
                                ) : (
                                  <>
                                    <input
                                      className="master-inline-input"
                                      type="text"
                                      placeholder={inputPlaceholder(f)}
                                      value={row[f.name] == null || row[f.name] === "" ? "" : String(row[f.name])}
                                      disabled={inputsDisabled}
                                      onChange={(e) => {
                                        const next = [...(value[tableKey] || [])];
                                        const prev = next[index] || {};
                                        next[index] = { ...prev, [f.name]: e.target.value, _lineSaved: false };
                                        setRows(tableKey, next);
                                      }}
                                      aria-label={f.label || f.name}
                                    />
                                  </>
                                )
                              ) : f.type === "lookup" && f.lookup && Number.isFinite(Number(f.rows)) && Number(f.rows) > 1 ? (
                                <textarea
                                  className="master-inline-input master-inline-textarea master-child-readonly"
                                  readOnly
                                  rows={Math.max(2, Number(f.rows) || 4)}
                                  value={formatLookupReadonlyValue(tableKey, f, row, lookupOptionsByField)}
                                  aria-label={f.label || f.name}
                                />
                              ) : (
                                <span className="master-child-readonly">
                                  {f.type === "number"
                                    ? formatInrAmount(toNumberOrZero(rowValueForField(row, f.name)))
                                    : f.type === "lookup" && f.lookup
                                        ? formatLookupReadonlyValue(tableKey, f, row, lookupOptionsByField)
                                        : formatViewCellValue(f, rowValueForField(row, f.name))}
                                </span>
                              );
                            })()}
                          </td>
                        ))}
                        <td className="data-table-actions-col master-child-actions-col">
                          <div className="table-action-btns master-child-row-btns">
                            <button
                              type="button"
                              className="icon-btn-table master-child-icon-act master-child-icon-act--save"
                              onClick={() => handleSaveLine(ct, tableKey, index)}
                              disabled={disabled || !isEditing}
                              title="Save this line"
                              aria-label="Save this line"
                            >
                              <SaveIcon />
                            </button>
                            <button
                              type="button"
                              className="icon-btn-table master-child-icon-act master-child-icon-act--edit"
                              onClick={() => handleEditLine(tableKey, index)}
                              disabled={disabled || isEditing || !isSaved}
                              title="Edit this line"
                              aria-label="Edit this line"
                            >
                              <EditIcon />
                            </button>
                            <button
                              type="button"
                              className="icon-btn-table master-child-icon-act master-child-icon-act--delete"
                              onClick={() => handleDeleteLine(tableKey, index)}
                              disabled={disabled}
                              title="Remove this line"
                              aria-label="Remove this line"
                            >
                              <TrashIcon />
                            </button>
                            <button
                              type="button"
                              className="icon-btn-table master-child-icon-act master-child-icon-act--add"
                              onClick={() => handleInsertRowAfter(tableKey, index)}
                              disabled={disabled}
                              title="Add a line below"
                              aria-label="Add a line below"
                            >
                              <PlusIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {fields.some((f) => f.type === "number") ? (
                  <tfoot>
                    <tr>
                      <td className="master-child-idx-col" />
                      {fields.map((f) => (
                        <td
                          key={`total-${f.name}`}
                          className={`master-child-field-col${f.type === "number" ? " master-child-number-col" : ""}`}
                        >
                          {f.type === "number" ? (
                            <strong>{formatInrAmount(numericFieldTotals[f.name] || 0)}</strong>
                          ) : f === fields[0] ? (
                            <strong className="master-child-total-label">Total</strong>
                          ) : (
                            ""
                          )}
                        </td>
                      ))}
                      <td className="data-table-actions-col master-child-actions-col" />
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
            {helperMessages.length ? (
              <p className="form-field-hint" role="note" style={{ marginTop: "6px" }}>
                {helperMessages[0]}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
