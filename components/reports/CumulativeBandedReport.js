"use client";

// Custom report table body — banded cumulative layout (section rowspan × detail rows).

import { formatInrNumberForDisplay } from "../../lib/formatInrNumber";

function formatInr(value) {
  const f = formatInrNumberForDisplay(value, { fixedDecimals: 2 });
  return f !== "" ? f : "0.00";
}

/**
 * @param {{
 *   custom?: object,
 *   financialYearCode?: string,
 *   recoveredColumnLabel?: string
 * }} props
 */
export default function CumulativeBandedReport({
  custom = {},
  financialYearCode = "",
  recoveredColumnLabel = "Cash Recovered"
}) {
  const sections = custom.sections || [];
  const grandTotal = custom.grandTotal || { caseCount: 0, cashRecovered: 0, npaReduced: 0 };
  const yearCode = financialYearCode || custom.financialYear?.yearCode || "";

  return (
    <div className="report-custom-table-wrap">
      <table className="report-custom-table">
        <thead>
          <tr className="report-custom-table-head">
            <th colSpan={2} rowSpan={2}>
              Particulars
            </th>
            <th colSpan={3}>{yearCode ? `For the Financial Year ${yearCode}` : "For the Financial Year"}</th>
          </tr>
          <tr className="report-custom-table-head">
            <th>No. of Cases</th>
            <th>{recoveredColumnLabel}</th>
            <th>NPA Reduced</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section, si) => (
            <SectionRows
              key={`${section.sectionId ?? section.regionId ?? si}-${section.sectionLabel ?? section.regionLabel}`}
              section={section}
            />
          ))}
          <tr className="report-custom-band-grand">
            <th colSpan={2}>Grand Total</th>
            <td className="num-center">{grandTotal.caseCount ?? 0}</td>
            <td className="num-right">{formatInr(grandTotal.cashRecovered)}</td>
            <td className="num-right">{formatInr(grandTotal.npaReduced)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * @param {{ section: object }} props
 */
function SectionRows({ section }) {
  const details = section.details || [];
  const sub = section.subtotal || {};
  const sectionLabel = section.sectionLabel ?? section.regionLabel ?? "";
  if (!details.length) return null;

  return (
    <>
      {details.map((detail, di) => {
        const detailLabel = detail.detailLabel ?? detail.loanCategoryLabel ?? detail.unitLabel ?? "";
        return (
          <tr key={`${sectionLabel}-${detailLabel}-${di}`}>
            {di === 0 ? (
              <td rowSpan={details.length} className="region-cell">
                {sectionLabel}
              </td>
            ) : null}
            <td>{detailLabel}</td>
            <td className="num-center">{detail.caseCount ?? 0}</td>
            <td className="num-right">{formatInr(detail.cashRecovered)}</td>
            <td className="num-right">{formatInr(detail.npaReduced)}</td>
          </tr>
        );
      })}
      <tr className="report-custom-band-subtotal">
        <td colSpan={2} />
        <td className="num-center">{sub.caseCount ?? 0}</td>
        <td className="num-right">{formatInr(sub.cashRecovered)}</td>
        <td className="num-right">{formatInr(sub.npaReduced)}</td>
      </tr>
    </>
  );
}
