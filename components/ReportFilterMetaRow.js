"use client";

// Report UI — filter summary and generated meta on one row.

import ReportOutputMeta from "./ReportOutputMeta";

/**
 * @param {{
 *   filterSummary?: string,
 *   meta?: object,
 *   showGeneratedAt?: boolean,
 *   showOutputMeta?: boolean
 * }} props
 */
export default function ReportFilterMetaRow({
  filterSummary = "",
  meta = {},
  showGeneratedAt = true,
  showOutputMeta = true
}) {
  const hasSummary = Boolean(String(filterSummary || "").trim());
  const showMetaLine = showOutputMeta !== false;
  const showTimestamp = showGeneratedAt !== false && Boolean(meta?.generatedAt);
  const hasMeta = showMetaLine && (showTimestamp || meta?.total != null);
  if (!hasSummary && !hasMeta) return null;

  return (
    <div className="report-output-filter-meta-row">
      {hasSummary ? <p className="report-output-filter-summary">{filterSummary}</p> : null}
      {hasMeta ? <ReportOutputMeta meta={meta} showGeneratedAt={showGeneratedAt} /> : null}
    </div>
  );
}
