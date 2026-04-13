"use client";

/**
 * FK field: LoV loads up to 500 rows from `/api/crud/:module?lov=1` (skips row scope). For `lookup_value_master`,
 * passes `filterLookupTypeName` / `filterLookupType` when set on `lookup` (see lib/lookupLovQueryParams.js).
 * `lookup.ui`: LoV — omit, `"lov"`, `"dropdown"`, `"select"`, `"list"`. Modal — `"picker"`, `"popup"`, `"modal"`, `"dialog"`.
 */
import { useEffect, useMemo, useState } from "react";
import { appendLookupValueMasterLovParams } from "../lib/lookupLovQueryParams";
import { normalizeLookupUi } from "../lib/lookupUi";
import { formatLookupRowLabel, resolveLookupLabelFieldName } from "../lib/lookupLabelField";
import LookupPicker from "./LookupPicker";

/**
 * If the saved FK is missing from the list (e.g. before lov=1 fix), still show one option so the value displays.
 */
function mergeMissingFkOption(options, lookup, labelField, val, initialLabel) {
  if (val == null || String(val).trim() === "") return options;
  const vf = lookup.valueField;
  const has = options.some((r) => String(r[vf]) === String(val));
  if (has) return options;
  const row = { [vf]: val };
  if (labelField) {
    row[labelField] =
      initialLabel != null && String(initialLabel).trim() !== ""
        ? String(initialLabel)
        : `#${val}`;
  }
  return [row, ...options];
}

/** @param {{ name: string, id: string, fieldLabel: string, lookup: object, initialValue?: string|number, initialLabel?: string, required?: boolean, disabled?: boolean }} props */
export default function LookupSelect({ name, id, fieldLabel, lookup, initialValue, initialLabel, required, disabled: disabledProp }) {
  const ui = normalizeLookupUi(lookup.ui);
  const labelField =
    resolveLookupLabelFieldName(lookup) || String(lookup?.valueField ?? "").trim() || "id";

  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState(() =>
    initialValue != null && initialValue !== "" ? String(initialValue) : ""
  );

  useEffect(() => {
    setValue(initialValue != null && initialValue !== "" ? String(initialValue) : "");
  }, [initialValue]);

  useEffect(() => {
    if (ui === "picker") return;
    let cancelled = false;
    async function load() {
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
        if (!cancelled && Array.isArray(json?.data)) setOptions(json.data);
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [ui, lookup, labelField]);

  if (ui === "picker") {
    return (
      <LookupPicker
        name={name}
        id={id}
        fieldLabel={fieldLabel}
        lookup={lookup}
        initialValue={initialValue}
        initialLabel={initialLabel}
        required={required}
        disabled={Boolean(disabledProp)}
      />
    );
  }

  const displayOptions = useMemo(
    () => mergeMissingFkOption(options, lookup, labelField, value, initialLabel),
    [options, lookup, labelField, value, initialLabel]
  );

  // Disabled controls are omitted from form submission; use a hidden input when the value is locked.
  const locked = Boolean(disabledProp);

  return (
    <>
      {locked ? (
        <input type="hidden" name={name} value={value} required={Boolean(required)} />
      ) : null}
      <select
        id={id}
        name={locked ? undefined : name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        required={!locked && Boolean(required)}
        disabled={loading || locked}
        aria-busy={loading}
      >
      <option value="">{loading ? "Loading…" : "Select…"}</option>
      {displayOptions.map((row) => {
        const v = row[lookup.valueField];
        const optKey = String(v);
        const lab = formatLookupRowLabel(row, lookup);
        return (
          <option key={optKey} value={optKey}>
            {lab !== "" ? lab : optKey}
          </option>
        );
      })}
    </select>
    </>
  );
}
