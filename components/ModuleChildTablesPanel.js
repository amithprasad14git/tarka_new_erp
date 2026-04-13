"use client";

/**
 * Line-item grids under the main master form (`childTables` in config).
 * Uses the same table + button styling as the master module (master-orders-table, master-btn).
 */
import { formatViewCellValue } from "../lib/formatViewCellValue";
import { rowValueForField } from "../lib/gridRowValue";

function newRowId() {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function newChildRowDraft() {
  return {
    _rowId: newRowId(),
    _editing: true,
    _lineSaved: false
  };
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
  return "10rem";
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
 *   disabled?: boolean,
 *   onNotify?: (kind: "success" | "error", message: string) => void
 * }} props
 */
export default function ModuleChildTablesPanel({ childTables, value, onChange, disabled = false, onNotify }) {
  if (!childTables?.length) return null;

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
    rows[index] = { ...row, _lineSaved: true, _editing: false };
    setRows(tableKey, rows);
  }

  function handleEditLine(tableKey, index) {
    const rows = [...(value[tableKey] || [])];
    const row = rows[index];
    if (!row) return;
    rows[index] = { ...row, _editing: true, _lineSaved: false };
    setRows(tableKey, rows);
  }

  function handleDeleteLine(tableKey, index) {
    const rows = [...(value[tableKey] || [])];
    rows.splice(index, 1);
    if (rows.length === 0) {
      setRows(tableKey, [newChildRowDraft()]);
    } else {
      setRows(tableKey, rows);
    }
  }

  function handleInsertRowAfter(tableKey, index) {
    const rows = [...(value[tableKey] || [])];
    rows.splice(index + 1, 0, newChildRowDraft());
    setRows(tableKey, rows);
  }

  return (
    <div className="module-child-tables">
      {childTables.map((ct) => {
        const tableKey = ct.key || ct.table;
        const rows = value[tableKey] || [];
        const fields = ct.fields || [];
        const colWidths = childTableColumnWidths(ct, fields);

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
                      <th key={f.name} className="master-child-field-col">
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
                          <td key={f.name} className="master-child-field-col">
                            {isEditing ? (
                              f.type === "date" ? (
                                <input
                                  className="master-inline-input"
                                  type="date"
                                  placeholder={inputPlaceholder(f)}
                                  value={
                                    row[f.name] != null && row[f.name] !== ""
                                      ? String(row[f.name]).slice(0, 10)
                                      : ""
                                  }
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
                                <input
                                  className="master-inline-input"
                                  type={f.type === "number" ? "number" : "text"}
                                  step={f.type === "number" ? "any" : undefined}
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
                              )
                            ) : (
                              <span className="master-child-readonly">
                                {formatViewCellValue(f, rowValueForField(row, f.name))}
                              </span>
                            )}
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
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
