"use client";

// Generic/shared file used across modules.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * FK field: LoV loads up to 500 rows from `/api/crud/:module?lov=1` (skips row scope). For `lookup_value_master`,
 * passes `filterLookupTypeName` / `filterLookupType` when set on `lookup` (see lib/lookupLovQueryParams.js).
 * `lookup.ui`: LoV — omit, `"lov"`, `"dropdown"`, `"select"`, `"list"`. Modal — `"picker"`, `"popup"`, `"modal"`, `"dialog"`.
 */
import { useEffect, useMemo, useState } from "react";
import { appendLookupValueMasterLovParams } from "../lib/lookupLovQueryParams";
import { normalizeLookupUi } from "../lib/lookupUi";
import { formatLookupRowLabel, resolveLookupLabelFieldName } from "../lib/lookupLabelField";
import { buildLookupLovCacheKey, fetchLookupLovCached } from "../lib/lookupLovCache";
import { formatUserFacingError, readApiErrorMessage } from "../lib/fetchClientError";
import { apiUserMessage } from "../lib/apiUserMessages";
import LookupPicker from "./LookupPicker";

function appendExtraLovParams(query, lookup) {
  // Some screens need dependent lookups (example: Assignee depends on selected To Unit).
  // We pass those extra query params here in a generic, reusable way.
  const extras = lookup?.extraLovParams;
  if (!extras || typeof extras !== "object") return;
  for (const [key, raw] of Object.entries(extras)) {
    const k = String(key || "").trim();
    const v = raw == null ? "" : String(raw).trim();
    if (!k || !v) continue;
    query.set(k, v);
  }
}

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

function normalizePreloadedOptions(options, lookup, labelField) {
  const vf = String(lookup?.valueField || "id").trim();
  return (Array.isArray(options) ? options : []).map((row) => {
    const value = row?.[vf] ?? row?.id ?? row?.value ?? "";
    const label = row?._label ?? row?.[labelField] ?? "";
    return { ...row, [vf]: value, [labelField]: label };
  });
}

/** @param {{ name: string, id: string, fieldLabel: string, lookup: object, initialValue?: string|number, initialLabel?: string, required?: boolean, disabled?: boolean, onValueChange?: (nextValue: string, nextLabel?: string) => void }} props */
export default function LookupSelect({
  name,
  id,
  fieldLabel,
  lookup,
  preloadedOptions = null,
  disableRemoteFetch = false,
  initialValue,
  initialLabel,
  required,
  disabled: disabledProp,
  onValueChange
}) {
  const ui = normalizeLookupUi(lookup.ui);
  const labelField =
    resolveLookupLabelFieldName(lookup) || String(lookup?.valueField ?? "").trim() || "id";

  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [value, setValue] = useState(() =>
    initialValue != null && initialValue !== "" ? String(initialValue) : ""
  );
  const extraLovEntries = Object.entries(lookup?.extraLovParams || {})
    .map(([k, v]) => [String(k || "").trim(), v == null ? "" : String(v).trim()])
    .filter(([k, v]) => Boolean(k) && Boolean(v))
    .sort(([a], [b]) => a.localeCompare(b));
  const extraLovParamsKey = JSON.stringify(extraLovEntries);
  const lookupFetchConfig = useMemo(() => {
    const extraLovParams = Object.fromEntries(extraLovEntries);
    return {
      module: String(lookup?.module || ""),
      filterLookupTypeName: String(lookup?.filterLookupTypeName || ""),
      filterLookupType: String(lookup?.filterLookupType || ""),
      extraLovParams
    };
  }, [lookup?.module, lookup?.filterLookupTypeName, lookup?.filterLookupType, extraLovParamsKey]);

  const lovCacheKey = useMemo(
    () => buildLookupLovCacheKey(lookupFetchConfig, labelField),
    [lookupFetchConfig, labelField]
  );

  useEffect(() => {
    setValue(initialValue != null && initialValue !== "" ? String(initialValue) : "");
  }, [initialValue]);

  useEffect(() => {
    if (disableRemoteFetch) {
      const safe = Array.isArray(preloadedOptions)
        ? normalizePreloadedOptions(preloadedOptions, lookup, labelField)
        : [];
      setOptions(safe);
      setLoading(false);
      return;
    }
    if (Array.isArray(preloadedOptions)) {
      setOptions(normalizePreloadedOptions(preloadedOptions, lookup, labelField));
      setLoading(false);
      return;
    }
    if (ui === "picker") return;
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    async function load() {
      try {
        const data = await fetchLookupLovCached(lovCacheKey, async () => {
          const q = new URLSearchParams({
            page: "1",
            limit: "500",
            search: "",
            sortBy: labelField || "id",
            sortDir: "asc",
            lov: "1"
          });
          appendLookupValueMasterLovParams(q, lookupFetchConfig);
          appendExtraLovParams(q, lookupFetchConfig);
          const res = await fetch(`/api/crud/${lookupFetchConfig.module}?${q.toString()}`);
          if (!res.ok) {
            throw new Error(await readApiErrorMessage(res, apiUserMessage("loadLookup")));
          }
          const json = await res.json();
          return Array.isArray(json?.data) ? json.data : [];
        });
        if (!cancelled) setOptions(data);
      } catch (e) {
        if (!cancelled) {
          setOptions([]);
          setLoadError(formatUserFacingError(e, { fallback: apiUserMessage("loadLookup") }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [ui, lovCacheKey, lookupFetchConfig, labelField, preloadedOptions, disableRemoteFetch]);

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
        onValueChange={onValueChange}
      />
    );
  }

  const displayOptions = useMemo(
    () => mergeMissingFkOption(options, lookup, labelField, value, initialLabel),
    [options, lookup, labelField, value, initialLabel]
  );
  // Friendly placeholder text helps users understand if list is empty due to filtering
  // instead of looking like a broken dropdown.
  const emptyMessage = loading
    ? "Loading…"
    : loadError
      ? "Options unavailable"
      : displayOptions.length === 0
        ? "No matching records"
        : "Select…";

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
        onChange={(e) => {
          const nextValue = e.target.value;
          setValue(nextValue);
          if (typeof onValueChange === "function") {
            const selectedRow = displayOptions.find(
              (row) => String(row[lookup.valueField]) === String(nextValue)
            );
            const nextLabel = selectedRow ? formatLookupRowLabel(selectedRow, lookup) : "";
            onValueChange(nextValue, nextLabel);
          }
        }}
        required={!locked && Boolean(required)}
        disabled={loading || locked}
        aria-busy={loading}
      >
      <option value="">{emptyMessage}</option>
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
    {loadError ? (
      <span className="muted lookup-load-error" role="alert">
        {loadError}
      </span>
    ) : null}
    </>
  );
}

