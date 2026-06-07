"use client";

// Custom report table body — Unit Wise Cummulative Summary (flat 4-column layout).

import { formatInrNumberForDisplay } from "../../lib/formatInrNumber";

function formatInr(value) {
  const f = formatInrNumberForDisplay(value, { fixedDecimals: 2 });
  return f !== "" ? f : "0.00";
}

/**
 * @param {{ custom?: object }} props
 */
export default function UnitWiseSummaryReport({ custom = {} }) {
  const rows = custom.rows || [];
  const totals = custom.totals || { caseCount: 0, cashRecovered: 0, npaReduced: 0 };

  return (
    <div className="report-custom-table-wrap">
      <table className="report-custom-flat-table report-custom-flat-table--unit-wise-summary">
        <thead>
          <tr className="report-custom-flat-table-head">
            <th>UNIT</th>
            <th>NO. OF CASES</th>
            <th>AMOUNT RECOVERED</th>
            <th>NPA REDUCED</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.unitId ?? i}-${row.unitLabel}`} className={i % 2 === 0 ? "report-custom-flat-row-even" : "report-custom-flat-row-odd"}>
              <td>{row.unitLabel}</td>
              <td className="num-right">{row.caseCount ?? 0}</td>
              <td className="num-right">{formatInr(row.cashRecovered)}</td>
              <td className="num-right">{formatInr(row.npaReduced)}</td>
            </tr>
          ))}
          <tr className="report-custom-flat-table-total">
            <td />
            <td className="num-right">{totals.caseCount ?? 0}</td>
            <td className="num-right">{formatInr(totals.cashRecovered)}</td>
            <td className="num-right">{formatInr(totals.npaReduced)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
