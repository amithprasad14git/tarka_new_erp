"use client";

// Report UI — custom-layout report shell (logo, title, bespoke table).

/**
 * HTML output for reportLayout.mode = "custom". Renders header (logo, title, FY, filters)
 * and delegates table body to components/reports/<Name>.js via customRenderer id.
 * contentAlign: "center" in reportLayout centers header + table (Region Wise Cummulative).
 */

import { useMemo, useState } from "react";
import { getReportHtmlCssVars } from "../config/reportExportTheme";
import RegionWiseCumulativeReport from "./reports/RegionWiseCumulativeReport";
import UnitWiseCumulativeReport from "./reports/UnitWiseCumulativeReport";
import SarfaesiCaseReport from "./reports/SarfaesiCaseReport";
import ReportFilterMetaRow from "./ReportFilterMetaRow";
import ReportOutputToolbar from "./ReportOutputToolbar";
import { useReportFullscreen } from "./useReportFullscreen";

const BODY_BY_RENDERER = {
  region_wise_cumulative: RegionWiseCumulativeReport,
  unit_wise_cumulative: UnitWiseCumulativeReport,
  sarfaesi_case_report: SarfaesiCaseReport
};

/**
 * @param {{
 *   reportLayout?: object,
 *   customRenderer?: string,
 *   custom?: object,
 *   filterSummary?: string,
 *   meta?: object
 * }} props
 */
export default function ReportCustomOutputView({
  reportLayout = {},
  customRenderer = "",
  custom = {},
  filterSummary = "",
  meta = {}
}) {
  const [fontPreset, setFontPreset] = useState("normal");
  const { fullscreen, setFullscreen } = useReportFullscreen();
  const htmlStyle = useMemo(() => getReportHtmlCssVars(fontPreset), [fontPreset]);
  const BodyComponent = BODY_BY_RENDERER[customRenderer] || null;
  const title = reportLayout.title || "Report";
  const fyRange = custom.financialYear?.yearRangeLabel || "";

  const hasBody = Boolean(BodyComponent);
  const centerContent = reportLayout.contentAlign === "center";

  return (
    <section
      className={`report-output report-custom-output card${centerContent ? " report-custom-output--centered" : ""}${fullscreen ? " report-output--fullscreen" : ""}`}
      aria-label="Report results"
      style={htmlStyle}
      data-font-preset={fontPreset}
      data-fullscreen={fullscreen ? "true" : "false"}
    >
      {hasBody ? (
        <ReportOutputToolbar
          fontPreset={fontPreset}
          onFontPresetChange={setFontPreset}
          fullscreen={fullscreen}
          onFullscreenChange={setFullscreen}
        />
      ) : null}

      {fullscreen ? null : (
        <header className="report-output-header report-custom-output-header">
          {reportLayout.showLogo !== false && reportLayout.logoPath ? (
            <img
              src={reportLayout.logoPath}
              alt=""
              className="report-output-logo report-output-logo--banner"
              width={400}
              height={58}
            />
          ) : null}
          <h3 className="report-output-title">{title}</h3>
          {fyRange ? <p className="report-custom-output-fy-line">Financial Year {fyRange}</p> : null}
          <ReportFilterMetaRow
            filterSummary={filterSummary}
            meta={meta}
            showGeneratedAt={reportLayout.showGeneratedAt}
            showOutputMeta={reportLayout.showOutputMeta}
          />
        </header>
      )}

      {BodyComponent ? (
        <BodyComponent custom={custom} financialYearCode={custom.financialYear?.yearCode} />
      ) : (
        <p className="muted">Custom report renderer not configured.</p>
      )}
    </section>
  );
}
