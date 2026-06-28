/**
 * Shared client helper — auto-fill In Favour Of from party_master lookup (Paid To / Party).
 */

import { rowValueForField } from "../gridRowValue";

export async function fetchPartyNameById(partyId) {
  const id = Number(partyId);
  if (!Number.isFinite(id) || id <= 0) return "";

  try {
    const res = await fetch(`/api/crud/party_master/${encodeURIComponent(String(id))}`);
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) return "";
    const data = payload?.data ?? payload;
    return String(rowValueForField(data, "partyName") ?? "").trim();
  } catch {
    return "";
  }
}

/**
 * @param {string} fieldName
 * @param {string} partyFieldName — e.g. "paidTo" or "party"
 * @param {unknown} value — party id from lookup
 * @param {React.Dispatch<React.SetStateAction<Record<string, string>>>} setAutoValues
 * @param {() => void} bumpInFavourOfInputKey
 * @returns {boolean}
 */
export function handlePartyInFavourOfAutoFill(
  fieldName,
  partyFieldName,
  value,
  setAutoValues,
  bumpInFavourOfInputKey
) {
  if (fieldName !== partyFieldName) return false;

  setAutoValues((prev) => ({ ...prev, inFavourOf: "" }));
  bumpInFavourOfInputKey();

  const partyId = Number(value);
  if (!Number.isFinite(partyId) || partyId <= 0) {
    return true;
  }

  void (async () => {
    const partyName = await fetchPartyNameById(partyId);
    setAutoValues((prev) => ({ ...prev, inFavourOf: partyName }));
    bumpInFavourOfInputKey();
  })();

  return true;
}
