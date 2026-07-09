"use client";

// Report UI — standard table output (frozen v1 renderer).

/**
 * HTML table for standard reports: logo, title, filter summary, zebra rows, totals, font toolbar.
 * Supports flat rows or grouped sections (section header, detail rows, subtotal, grand total).
 * Styling via reportExportTheme CSS vars + app/globals.css (.report-output*). See docs/REPORTS.md.
 */

import { useMemo, useState } from "react";
import { formatReportCellValue } from "../lib/formatReportCellValue";
import { formatReportAmountForDisplay } from "../lib/formatInrNumber";
import { getReportHtmlCssVars } from "../config/reportExportTheme";
import { htmlColumnWidthPercents } from "../lib/reports/htmlColumnWidths";
import ReportFilterMetaRow from "./ReportFilterMetaRow";
import ReportOutputToolbar from "./ReportOutputToolbar";
import ReportTableScrollRegion from "./ReportTableScrollRegion";
import { useReportFullscreen } from "./useReportFullscreen";

function cellAlignStyle(align) {
  const a = align || "left";
  return { textAlign: a };
}

function htmlColumnMinWidth(widthHtml) {
  const s = String(widthHtml ?? "").trim();
  if (!s) return undefined;
  if (/^calc\(/i.test(s) || /^[\d.]+\s*(rem|px|%)$/i.test(s)) return s;
  return undefined;
}

function cellClassName(col) {
  if (col.type === "inr") return "report-output-cell--inr";
  if (col.type === "number") return "report-output-cell--number";
  if (col.type === "date") return "report-output-cell--date";
  return undefined;
}

function cellStyle(col, tableFitContent) {
  const style = cellAlignStyle(col.align);
  if (tableFitContent) {
    const minWidth = htmlColumnMinWidth(col.widthHtml);
    if (minWidth) style.minWidth = minWidth;
  }
  return style;
}

function renderSumRowCells(columns, labelColKey, labelText, sumValues, tableFitContent) {
  const labelColExists = columns.some((col) => col.key === labelColKey);
  return columns.map((col) => {
    let content = "";
    if (col.key === labelColKey || (!labelColExists && columns[0]?.key === col.key)) content = labelText;
    else if (col.sum && sumValues?.[col.key] != null) {
      content = formatReportAmountForDisplay(sumValues[col.key]);
    }
    return (
      <td key={col.key} className={cellClassName(col)} style={cellStyle(col, tableFitContent)}>
        {content}
      </td>
    );
  });
}

function renderDetailRow(columns, row, rowIndex, tableFitContent) {
  return (
    <tr
      key={rowIndex}
      className={rowIndex % 2 === 0 ? "report-output-row-even" : "report-output-row-odd"}
    >
      {columns.map((col) => (
        <td key={col.key} className={cellClassName(col)} style={cellStyle(col, tableFitContent)}>
          {formatReportCellValue(col, row[col.key])}
        </td>
      ))}
    </tr>
  );
}

/**
 * @param {{
 *   reportLayout?: object,
 *   reportStyle?: object,
 *   columns?: object[],
 *   rows?: object[],
 *   totals?: Record<string, number>,
 *   groupedSections?: Array<{
 *     headerLabel?: string,
 *     label?: string,
 *     rows?: object[],
 *     monthGroups?: Array<{ headerLabel?: string, label?: string, rows?: object[], subtotal?: Record<string, number> }>,
 *     subtotal?: Record<string, number>
 *   }>,
 *   grandTotal?: Record<string, number>,
 *   filterSummary?: string,
 *   meta?: object
 * }} props
 */
export default function ReportOutputView({
  reportLayout = {},
  reportStyle = {},
  columns = [],
  rows = [],
  totals = {},
  groupedSections = [],
  grandTotal = null,
  filterSummary = "",
  meta = {}
}) {
  const [fontPreset, setFontPreset] = useState("normal");
  const { fullscreen, setFullscreen } = useReportFullscreen();
  const totalRow = reportStyle?.totalRow || {};
  const sectionTotalRow = reportStyle?.sectionTotalRow || {};
  const subgroupHeaderRow = reportStyle?.subgroupHeaderRow || {};
  const subgroupTotalRow = reportStyle?.subgroupTotalRow || {};
  const labelColKey = totalRow.labelColumn || sectionTotalRow.labelColumn;
  const isGrouped = groupedSections.length > 0;
  const showFlatTotals = !isGrouped && columns.some((col) => col.sum) && Object.keys(totals).length > 0;
  const showGrandTotal =
    isGrouped && columns.some((col) => col.sum) && grandTotal && Object.keys(grandTotal).length > 0;
  const groupedRowCount = groupedSections.reduce(
    (n, s) =>
      n +
      (s.rows?.length || 0) +
      (s.monthGroups || []).reduce((inner, g) => inner + (g.rows?.length || 0), 0),
    0
  );
  const hasTable = isGrouped ? groupedRowCount > 0 : rows.length > 0;

  const colWidths = useMemo(() => htmlColumnWidthPercents(columns), [columns]);
  const htmlStyle = useMemo(() => getReportHtmlCssVars(fontPreset), [fontPreset]);
  const centerContent = reportLayout.contentAlign === "center";
  const tableFitContent = Boolean(reportLayout.tableFitContent);

  let zebraIndex = 0;
  const groupedBody = isGrouped
    ? groupedSections.flatMap((section, si) => {
        const headerText = section.headerLabel || section.label || "";
        const sectionRows = section.rows || [];
        const monthGroups = section.monthGroups || [];
        const elements = [
          <tr key={`section-h-${si}`} className="report-output-section-header">
            <td colSpan={columns.length}>{headerText}</td>
          </tr>
        ];
        for (const row of sectionRows) {
          elements.push(renderDetailRow(columns, row, `section-${si}-row-${zebraIndex}`, tableFitContent));
          zebraIndex += 1;
        }
        for (let gi = 0; gi < monthGroups.length; gi++) {
          const monthGroup = monthGroups[gi];
          const subgroupText = monthGroup.headerLabel || monthGroup.label || "";
          elements.push(
            <tr
              key={`section-${si}-group-h-${gi}`}
              className="report-output-section-header"
              style={subgroupHeaderRow.background ? { background: subgroupHeaderRow.background } : undefined}
            >
              <td colSpan={columns.length}>{subgroupText}</td>
            </tr>
          );
          for (const row of monthGroup.rows || []) {
            elements.push(
              renderDetailRow(columns, row, `section-${si}-group-${gi}-row-${zebraIndex}`, tableFitContent)
            );
            zebraIndex += 1;
          }
          if (columns.some((col) => col.sum) && monthGroup.subtotal) {
            elements.push(
              <tr
                key={`section-${si}-group-t-${gi}`}
                className="report-output-section-total-row"
                style={subgroupTotalRow.background ? { background: subgroupTotalRow.background } : undefined}
              >
                {renderSumRowCells(
                  columns,
                  subgroupTotalRow.labelColumn || labelColKey,
                  subgroupTotalRow.label || "Subtotal",
                  monthGroup.subtotal,
                  tableFitContent
                )}
              </tr>
            );
          }
        }
        if (columns.some((col) => col.sum) && section.subtotal) {
          elements.push(
            <tr key={`section-t-${si}`} className="report-output-section-total-row">
              {renderSumRowCells(
                columns,
                labelColKey,
                sectionTotalRow.label || "Subtotal",
                section.subtotal,
                tableFitContent
              )}
            </tr>
          );
        }
        return elements;
      })
    : null;

  return (
    <section
      className={`report-output card${fullscreen ? " report-output--fullscreen" : ""}${
        centerContent ? " report-output--centered" : ""
      }`}
      aria-label="Report results"
      style={htmlStyle}
      data-font-preset={fontPreset}
      data-fullscreen={fullscreen ? "true" : "false"}
    >
      {hasTable ? (
        <ReportOutputToolbar
          fontPreset={fontPreset}
          onFontPresetChange={setFontPreset}
          fullscreen={fullscreen}
          onFullscreenChange={setFullscreen}
        />
      ) : null}

      {fullscreen ? null : (
        <header className="report-output-header">
          {reportLayout.showLogo !== false && reportLayout.logoPath ? (
            <img
              src={reportLayout.logoPath}
              alt=""
              className="report-output-logo report-output-logo--banner"
              width={400}
              height={58}
            />
          ) : null}
          {reportLayout.title ? <h3 className="report-output-title">{reportLayout.title}</h3> : null}
          <ReportFilterMetaRow
            filterSummary={filterSummary}
            meta={meta}
            showGeneratedAt={reportLayout.showGeneratedAt}
            showOutputMeta={reportLayout.showOutputMeta}
          />
        </header>
      )}

      {hasTable ? (
        <div
          className={`report-output-table-wrap${
            tableFitContent ? " report-output-table-wrap--fit" : ""
          }`}
        >
          <ReportTableScrollRegion>
            <table className="report-output-table">
              <colgroup>
                {columns.map((col, i) => (
                  <col
                    key={col.key}
                    style={{
                      width: tableFitContent
                        ? htmlColumnMinWidth(col.widthHtml) || colWidths[i]
                        : colWidths[i]
                    }}
                  />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} className={cellClassName(col)} style={cellStyle(col, tableFitContent)}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isGrouped
                  ? groupedBody
                  : rows.map((row, ri) => renderDetailRow(columns, row, ri, tableFitContent))}
              </tbody>
              {showFlatTotals || showGrandTotal ? (
                <tfoot>
                  <tr className="report-output-tfoot-row">
                    {renderSumRowCells(
                      columns,
                      labelColKey,
                      totalRow.label || "Total",
                      isGrouped ? grandTotal : totals,
                      tableFitContent
                    )}
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </ReportTableScrollRegion>
        </div>
      ) : (
        <p className="report-output-empty muted">No records for the selected filters.</p>
      )}
    </section>
  );
}
