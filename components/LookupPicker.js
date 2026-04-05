"use client";

/**
 * Modal lookup: search, paged table, double-click selects FK id + label.
 * Columns: `lookup.pickerColumns` or default from lib/lookupUi.js.
 */
import { useEffect, useMemo, useState } from "react";
import { getPickerColumns } from "../lib/lookupUi";
import { resolveLookupLabelFieldName } from "../lib/lookupLabelField";

function MagnifyingGlassIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <line x1="16.65" y1="16.65" x2="21" y2="21" />
    </svg>
  );
}

/**
 * Large-dataset lookup: readonly display + search icon opens modal with debounced search and double-click select.
 * @param {{ name: string, id: string, fieldLabel: string, lookup: object, initialValue?: string|number, initialLabel?: string, required?: boolean }} props
 */
export default function LookupPicker({ name, id, fieldLabel, lookup, initialValue, initialLabel, required }) {
  const pageSize = Math.min(Math.max(Number(lookup.pickerLimit) || 20, 5), 100);
  const { valueField } = lookup;
  const labelField =
    resolveLookupLabelFieldName(lookup) || String(lookup?.valueField ?? "").trim() || "id";
  const sortField = lookup.pickerSortBy || labelField;

  const columns = useMemo(() => getPickerColumns(lookup), [lookup]);

  const [selectedId, setSelectedId] = useState(() =>
    initialValue != null && initialValue !== "" ? String(initialValue) : ""
  );
  const [selectedLabel, setSelectedLabel] = useState(() => String(initialLabel ?? ""));

  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    setSelectedId(initialValue != null && initialValue !== "" ? String(initialValue) : "");
  }, [initialValue]);

  useEffect(() => {
    if (initialLabel != null && initialLabel !== undefined) {
      setSelectedLabel(String(initialLabel));
    }
  }, [initialLabel]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    if (!selectedId || selectedLabel) return;
    let cancelled = false;
    async function resolve() {
      setResolving(true);
      try {
        const q = new URLSearchParams({
          page: "1",
          limit: "500",
          search: "",
          sortBy: "id",
          sortDir: "asc",
          lov: "1"
        });
        const res = await fetch(`/api/crud/${lookup.module}?${q.toString()}`);
        const json = await res.json();
        const list = Array.isArray(json?.data) ? json.data : [];
        const row = list.find((r) => String(r[valueField]) === String(selectedId));
        if (!cancelled && row) {
          setSelectedLabel(String(row[labelField] ?? ""));
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setResolving(false);
      }
    }
    resolve();
    return () => {
      cancelled = true;
    };
  }, [selectedId, selectedLabel, lookup.module, valueField, labelField]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const q = new URLSearchParams({
          page: String(page),
          limit: String(pageSize),
          search: debouncedSearch,
          sortBy: sortField,
          sortDir: "asc",
          lov: "1"
        });
        const res = await fetch(`/api/crud/${lookup.module}?${q.toString()}`);
        const json = await res.json();
        if (cancelled) return;
        setRows(Array.isArray(json?.data) ? json.data : []);
        setMeta(json?.meta || { totalPages: 1, page: 1 });
      } catch {
        if (!cancelled) {
          setRows([]);
          setMeta({ totalPages: 1 });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [open, page, debouncedSearch, lookup.module, sortField, pageSize]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function selectRow(row) {
    const v = row[valueField];
    setSelectedId(String(v));
    setSelectedLabel(String(row[labelField] ?? ""));
    setOpen(false);
  }

  const totalPages = Math.max(1, Number(meta.totalPages) || 1);
  const displayText = resolving ? "Loading…" : selectedLabel || (selectedId ? `(id: ${selectedId})` : "");

  return (
    <div className="lookup-picker">
      <input type="hidden" name={name} value={selectedId} required={Boolean(required)} />
      <div className="lookup-picker-control">
        <input
          type="text"
          readOnly
          className="lookup-picker-display"
          id={id}
          value={displayText}
          placeholder="Select…"
          aria-required={Boolean(required)}
        />
        <button
          type="button"
          className="lookup-picker-trigger"
          onClick={() => {
            setOpen(true);
            setSearchInput("");
            setDebouncedSearch("");
            setPage(1);
          }}
          title="Open lookup search"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <MagnifyingGlassIcon />
        </button>
      </div>

      {open ? (
        <div className="lookup-picker-modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="lookup-picker-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-lookup-title`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lookup-picker-modal-header">
              <h2 id={`${id}-lookup-title`} className="lookup-picker-modal-title">
                {fieldLabel}
              </h2>
              <button type="button" className="lookup-picker-close" onClick={() => setOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="lookup-picker-search">
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search…"
                className="lookup-picker-search-input"
                autoFocus
              />
            </div>
            <div className="lookup-picker-table-wrap">
              {loading ? (
                <p className="lookup-picker-loading">Loading…</p>
              ) : (
                <table className="data-table data-table-compact lookup-picker-table">
                  <thead>
                    <tr>
                      {columns.map((col) => (
                        <th key={col.field} scope="col">
                          {col.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td className="lookup-picker-empty" colSpan={Math.max(1, columns.length)}>
                          No rows
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr
                          key={String(row[valueField])}
                          className="lookup-picker-row"
                          onDoubleClick={() => selectRow(row)}
                          title="Double-click to select"
                        >
                          {columns.map((col) => (
                            <td key={col.field}>
                              {row[col.field] != null && row[col.field] !== "" ? String(row[col.field]) : ""}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
            <div className="lookup-picker-modal-footer">
              <button
                type="button"
                className="lookup-picker-page-btn"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className="lookup-picker-page-info">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                className="lookup-picker-page-btn"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
            <p className="lookup-picker-hint" aria-hidden>
              Double-click a row to select.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
