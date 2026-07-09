"use client";

// Report UI — filter form, Generate (HTML | Excel), read-only output.

/**
 * Dashboard report tab: DynamicForm filters, Generate / Clear, then ReportOutputView
 * (table) or ReportCustomOutputView (bespoke layout). Fetches GET /api/reports/<key>/run.
 * Config from config/reports.js. See docs/REPORTS.md.
 */

import { useCallback, useMemo, useState } from "react";
import { getReportConfig } from "../lib/reportConfig";
import { getReportFilterInitialValues } from "../lib/reports/reportFilterDefaults";
import DynamicForm from "./DynamicForm";
import LoadingOverlay from "./LoadingOverlay";
import ToastNotice from "./ToastNotice";
import ReportOutputView from "./ReportOutputView";
import ReportCustomOutputView from "./ReportCustomOutputView";
import ReportOutputSkeleton from "./ReportOutputSkeleton";
import {
  formatApiErrorPayload,
  formatUserFacingError,
  isUnauthorizedMessage,
  resolveSessionAuthDisplayMessage,
  readApiErrorMessage,
  readJsonResponse
} from "../lib/fetchClientError";
import { apiUserMessage } from "../lib/apiUserMessages";
/**
 * @param {{ reportKey: string, isActive?: boolean }} props
 */
export default function ReportModuleClient({ reportKey, isActive = true }) {
  const config = useMemo(() => getReportConfig(reportKey), [reportKey]);
  const [filterValues, setFilterValues] = useState(() => {
    const cfg = getReportConfig(reportKey);
    return cfg ? getReportFilterInitialValues(cfg) : {};
  });
  const [lookupLabels, setLookupLabels] = useState({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [htmlResult, setHtmlResult] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [htmlLoading, setHtmlLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);

  const fieldUiOverrides = useMemo(() => {
    const overrides = {};
    const cascade = config?.filterCascade || [];
    for (const rule of cascade) {
      const parentVal = filterValues[rule.parent];
      const childField = (config?.fields || []).find((f) => f.name === rule.child);
      if (!childField?.lookup) continue;
      const extra = { ...(childField.lookup.extraLovParams || {}) };
      if (parentVal && String(parentVal).trim() !== "" && Number.isFinite(Number(parentVal))) {
        extra[rule.lovParam] = String(parentVal);
      }
      overrides[rule.child] = {
        lookup: { ...childField.lookup, extraLovParams: extra }
      };
    }
    return overrides;
  }, [config, filterValues]);

  function showToastMessage(kind, message) {
    const text = String(message || "").trim();
    if (kind === "error" && isUnauthorizedMessage(text)) {
      setToast({ kind: "error", message: resolveSessionAuthDisplayMessage(text) });
      return;
    }
    setToast({ kind, message: text });
  }

  function handleFieldValueChange(fieldName, value) {
    setFilterValues((prev) => {
      const next = { ...prev, [fieldName]: value };
      const cascade = config?.filterCascade || [];
      for (const rule of cascade) {
        if (rule.parent === fieldName) {
          next[rule.child] = "";
          let child = rule.child;
          while (true) {
            const downstream = cascade.find((c) => c.parent === child);
            if (!downstream) break;
            next[downstream.child] = "";
            child = downstream.child;
          }
        }
      }
      return next;
    });

    if (config?.fields?.find((f) => f.name === fieldName)?.type === "lookup") {
      setLookupLabels((prev) => {
        const copy = { ...prev };
        delete copy[fieldName];
        return copy;
      });
    }
  }

  const captureLookupLabelFromForm = useCallback(() => {
    const form = document.getElementById(`report-filters-${reportKey}`);
    if (!form) return {};
    const labels = {};
    for (const f of config?.fields || []) {
      if (f.type !== "lookup") continue;
      const hidden = form.querySelector(`input[type="hidden"][name="${f.name}"]`);
      const val = hidden?.value ?? filterValues[f.name];
      if (!val || !String(val).trim()) continue;
      const control = form.querySelector(`#field-${f.name}`);
      if (!control) continue;
      if (control.tagName === "SELECT") {
        const opt = control.options[control.selectedIndex];
        if (opt?.value && opt.text && opt.text !== "Select…" && opt.text !== "Loading…") {
          labels[f.name] = opt.text;
        }
        continue;
      }
      const text = String(control.value || "").trim();
      if (text && !/^\(id:\s*\d+\)$/i.test(text)) {
        labels[f.name] = text;
      }
    }
    return labels;
  }, [config, filterValues, reportKey]);

  function readFiltersFromForm() {
    const merged = { ...filterValues };
    const form = document.getElementById(`report-filters-${reportKey}`);
    if (!form) return merged;
    const fd = new FormData(form);
    for (const f of config.fields || []) {
      const v = fd.get(f.name);
      if (v != null && String(v).trim() !== "") {
        merged[f.name] = String(v);
        continue;
      }
      if (
        f.type === "select" &&
        f.default != null &&
        f.default !== "" &&
        f.default !== "monthStart" &&
        f.default !== "monthEnd" &&
        f.default !== "today"
      ) {
        merged[f.name] = String(f.default);
      }
    }
    return merged;
  }

  async function handleGenerate(e) {
    e?.preventDefault?.();
    if (!config) return;

    // Read latest filter values; Excel downloads blob, HTML stores JSON for output view.
    const activeFilters = readFiltersFromForm();
    setFilterValues(activeFilters);
    const labels = { ...lookupLabels, ...captureLookupLabelFromForm() };
    const format = String(activeFilters.outputFormat || "HTML").toUpperCase();
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(activeFilters)) {
      if (v == null || v === "") continue;
      q.set(k, String(v));
    }
    q.set("format", format === "EXCEL" ? "excel" : "html");
    if (Object.keys(labels).length) q.set("filterLabels", JSON.stringify(labels));

    setBusy(true);
    setToast(null);
    if (format === "EXCEL") {
      setExcelLoading(true);
    } else {
      setHtmlLoading(true);
      setHtmlResult(null);
    }
    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(reportKey)}/run?${q}`);
      if (format === "EXCEL") {
        if (!res.ok) {
          throw new Error(await readApiErrorMessage(res, apiUserMessage("exportReport")));
        }
        const blob = await res.blob();
        const disp = res.headers.get("Content-Disposition") || "";
        const m = /filename="([^"]+)"/i.exec(disp);
        const filename = m?.[1] || "report.xlsx";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setHtmlResult(null);
        showToastMessage("success", "Excel file downloaded.");
        return;
      }

      const payload = await readJsonResponse(res);
      if (!res.ok) {
        throw new Error(formatApiErrorPayload(payload, apiUserMessage("runReport")));
      }
      setHtmlResult(payload);
    } catch (err) {
      showToastMessage("error", formatUserFacingError(err, { fallback: apiUserMessage("runReport") }));
    } finally {
      setBusy(false);
      setHtmlLoading(false);
      setExcelLoading(false);
    }
  }

  function handleClear() {
    if (!config) return;
    setFilterValues(getReportFilterInitialValues(config));
    setLookupLabels({});
    setHtmlResult(null);
    setFormKey((k) => k + 1);
  }

  if (!config) {
    return <p className="muted">Unknown report.</p>;
  }

  const pseudoConfig = useMemo(() => ({ fields: config?.fields || [] }), [config]);

  return (
    <div className="master-module-page report-module-page">
      <LoadingOverlay busy={excelLoading} label="Preparing Excel…" />
      <ToastNotice toast={toast} onClose={() => setToast(null)} />

      <div className="master-module-header">
        <h1 className="module-page-title">{config.label || reportKey}</h1>
      </div>

      <div className="card report-filters-card">
        <DynamicForm
          key={formKey}
          formId={`report-filters-${reportKey}`}
          config={pseudoConfig}
          initialValues={filterValues}
          hideButtons
          className=""
          formRootStyle={{ marginBottom: 0 }}
          fieldUiOverrides={fieldUiOverrides}
          onFieldValueChange={handleFieldValueChange}
          onSubmit={handleGenerate}
        />
        <div className="report-filter-actions">
          <button type="button" className="btn-primary" disabled={busy} onClick={handleGenerate}>
            Generate
          </button>
          <button type="button" className="master-btn master-btn-outline" disabled={busy} onClick={handleClear}>
            Clear filters
          </button>
        </div>
      </div>

      {htmlLoading ? <ReportOutputSkeleton /> : null}

      {!htmlLoading && htmlResult ? (
        htmlResult.layout === "custom" ? (
          <ReportCustomOutputView
            reportLayout={htmlResult.reportLayout}
            customRenderer={htmlResult.customRenderer}
            custom={htmlResult.custom}
            filterSummary={htmlResult.filterSummary}
            meta={htmlResult.meta}
          />
        ) : (
          <ReportOutputView
            reportLayout={htmlResult.reportLayout}
            reportStyle={htmlResult.reportStyle}
            columns={htmlResult.columns}
            rows={htmlResult.rows}
            totals={htmlResult.totals}
            groupedSections={htmlResult.groupedSections}
            grandTotal={htmlResult.grandTotal}
            filterSummary={htmlResult.filterSummary}
            meta={htmlResult.meta}
          />
        )
      ) : null}
    </div>
  );
}
