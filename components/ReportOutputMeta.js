"use client";

// Report UI — generated timestamp and record count (right-aligned).

import { formatReportGeneratedAtDisplay } from "../lib/formatReportGeneratedAt";

/**
 * @param {{
 *   meta?: { generatedAt?: string, total?: number, truncated?: boolean },
 *   showGeneratedAt?: boolean
 * }} props
 */
export default function ReportOutputMeta({ meta = {}, showGeneratedAt = true }) {
  const { generatedAt, total, truncated } = meta;
  const showTimestamp = showGeneratedAt !== false && Boolean(generatedAt);
  if (!showTimestamp && total == null) return null;

  const parts = [];
  if (showTimestamp) parts.push(`Generated: ${formatReportGeneratedAtDisplay(generatedAt)}`);
  if (total != null) {
    const n = Number(total) || 0;
    parts.push(`${n.toLocaleString()} record${n === 1 ? "" : "s"}`);
  }
  if (truncated) parts.push("(row limit reached)");

  return (
    <p className="report-output-meta" aria-live="polite">
      {parts.join(" · ")}
    </p>
  );
}

