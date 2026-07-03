/**
 * Shared client helper — auto-fill In Favour Of from the selected party lookup label.
 */

/**
 * @param {string} fieldName
 * @param {string} partyFieldName — e.g. "paidTo" or "party"
 * @param {unknown} value — party id from lookup
 * @param {React.Dispatch<React.SetStateAction<Record<string, string>>>} setAutoValues
 * @param {() => void} bumpInFavourOfInputKey
 * @param {string} partyLabel
 * @returns {boolean}
 */
export function handlePartyInFavourOfAutoFill(
  fieldName,
  partyFieldName,
  value,
  setAutoValues,
  bumpInFavourOfInputKey,
  partyLabel = ""
) {
  if (fieldName !== partyFieldName) return false;

  const trimmedLabel = String(partyLabel ?? "").trim();
  setAutoValues((prev) => ({ ...prev, inFavourOf: trimmedLabel }));
  bumpInFavourOfInputKey();

  const partyId = Number(value);
  if (!Number.isFinite(partyId) || partyId <= 0) {
    return true;
  }

  return true;
}
