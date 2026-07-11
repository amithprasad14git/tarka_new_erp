/**
 * =============================================================================
 * INVOICES RECEIVED AMOUNTS — TDS / received amount math (no React)
 * =============================================================================
 * Matches legacy desktop CalculateTDSAndReceivedAmount: given billed amount,
 * TDS %, and round-off choice, compute TDS amount and net received. Used by
 * the browser form and Jest (no DB).
 * =============================================================================
 */

/**
 * Derive TDS amount and received amount from billed amount + round-off mode.
 * @param {{ billedAmount: unknown, tdsPercentage: unknown, roundOff: unknown }} input
 * @returns {{ tdsPercentage: number, tdsAmount: number, receivedAmount: number }}
 */
export function computeInvoicesReceivedAmounts({ billedAmount, tdsPercentage, roundOff }) {
  // Derive TDS and net received from billed amount; round-off choice matches legacy desktop rules.
  const billed = parseFloat(billedAmount);
  const billedSafe = Number.isFinite(billed) ? billed : 0;

  const pctText = tdsPercentage == null ? "" : String(tdsPercentage).trim();
  const pctNum = parseFloat(pctText);
  if (pctText === "" || Number.isNaN(pctNum)) {
    return { tdsPercentage: 0, tdsAmount: 0, receivedAmount: billedSafe };
  }

  const pct = pctNum / 100;
  const ro = roundOff == null ? "" : String(roundOff).trim();

  // Round-off choice matches legacy desktop behaviour (ceil/floor vs plain subtract).
  let tdsAmount = 0;
  let receivedAmount = 0;

  if (ro === "Round Down") {
    tdsAmount = Math.ceil(billedSafe * pct);
    receivedAmount = Math.ceil(billedSafe - tdsAmount);
  } else if (ro === "Round Up") {
    tdsAmount = Math.floor(billedSafe * pct);
    receivedAmount = Math.floor(billedSafe - tdsAmount);
  } else {
    tdsAmount = billedSafe * pct;
    receivedAmount = billedSafe - tdsAmount;
  }

  return { tdsPercentage: pctNum, tdsAmount, receivedAmount };
}
