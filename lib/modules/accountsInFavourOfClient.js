/**
 * =============================================================================
 * IN FAVOUR OF AUTO-FILL — Copy party lookup label into payee text
 * =============================================================================
 * Accounts vouchers often need “In Favour Of” to match the selected party name.
 * When the party/paidTo lookup changes, copy its display label into inFavourOf
 * and bump the input key so the controlled field refreshes.
 * =============================================================================
 */

/**
 * When the party lookup field changes, copy its label into `inFavourOf`.
 * Shared by loan AC, expense voucher, and assets/investments client models.
 * @param {string} fieldName
 * @param {string} partyFieldName — e.g. "paidTo" or "party"
 * @param {unknown} value — party id from lookup
 * @param {React.Dispatch<React.SetStateAction<Record<string, string>>>} setAutoValues
 * @param {() => void} bumpInFavourOfInputKey
 * @param {string} partyLabel
 * @returns {boolean} true when this field was the party lookup (handled)
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
