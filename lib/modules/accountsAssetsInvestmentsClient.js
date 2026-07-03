/**
 * accountsAssetsInvestments — browser-only behaviour (forms, pickers, Print/download).
 * Server save rules: lib/modules/accountsAssetsInvestments.js
 */

// Module-specific file: client-side behaviour for this module only.
// Wire into MasterModuleClient (or equivalent) when ready — exports mirror transfer_case patterns.

import { useEffect, useMemo, useState } from "react";
import { handlePartyInFavourOfAutoFill } from "./accountsInFavourOfClient";

/** Keep in sync with ACCOUNTS_ASSETS_INVESTMENTS_UNIT_RESTRICT_ROLE in accountsAssetsInvestments.js */
const UNIT_RESTRICT_ROLE = 2;

/**
 * Same strings as `accounts_assets_investments.postCreateAck` in config/modules.js and
 * ACCOUNTS_ASSETS_INVESTMENTS_POST_CREATE_ACK_CONFIG in accountsAssetsInvestments.js (modal is generic UI).
 */
export const ACCOUNTS_ASSETS_INVESTMENTS_POST_CREATE_ACK_UI = {
  field: "voucherNo",
  title: "Assets & Investments saved",
  hint: "Your voucher number is shown below. Continue to return to the list.",
  valueLabel: "Voucher No",
  showPrintPdf: false,
  showCopyButton: false
};

export function isAccountsAssetsInvestmentsModule(moduleKey) {
  return moduleKey === "accounts_assets_investments";
}

function sessionUnitAsNumber(sessionUnit) {
  const u = Number(sessionUnit != null ? String(sessionUnit).trim() : NaN);
  return Number.isFinite(u) && u > 0 ? u : null;
}

/**
 * Role 2: restrict current_account_master LoV to rows for the user’s unit (`f_unit`).
 * Admins: no extra params (full list per CRUD list rules).
 */
function npaCurrentAcLookupExtraParams(sessionRole, sessionUnit) {
  const base = { f_active: "Yes" };
  if (Number(sessionRole) !== UNIT_RESTRICT_ROLE) return base;
  const u = sessionUnitAsNumber(sessionUnit);
  if (!u) return base;
  return { ...base, f_unit: String(u) };
}

/**
 * Loads first active current account for the unit (role 2 new entry) to auto-fill npaCurrentAc when unambiguous.
 */
async function fetchFirstCurrentAccountIdForUnit(unitId) {
  const url = `/api/crud/current_account_master?page=1&limit=10&sortBy=id&sortDir=asc&lov=1&f_unit=${encodeURIComponent(
    String(unitId)
  )}&f_active=Yes`;
  const res = await fetch(url);
  const payload = await res.json().catch(() => ({}));
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const first = rows[0];
  const id = first?.id;
  return id != null && String(id).trim() !== "" ? String(id) : "";
}

/**
 * Keeps Assets & Investments UI rules out of generic components.
 */
export function useAccountsAssetsInvestmentsClientModel({
  moduleKey,
  editingRow,
  formKey,
  sessionRole,
  sessionUnit
}) {
  const [autoValues, setAutoValues] = useState({});
  const [inFavourOfInputKey, setInFavourOfInputKey] = useState(0);

  useEffect(() => {
    // New entry for unit operators: lock unit and pick the first active NPA current account for that unit.
    if (!isAccountsAssetsInvestmentsModule(moduleKey)) {
      setAutoValues({});
      setInFavourOfInputKey(0);
      return;
    }

    setInFavourOfInputKey(0);

    if (editingRow) {
      setAutoValues({
        unit: editingRow?.unit ?? "",
        npaCurrentAc: editingRow?.npaCurrentAc ?? ""
      });
      return;
    }

    if (Number(sessionRole) !== UNIT_RESTRICT_ROLE) {
      setAutoValues({});
      return;
    }

    const unitId = sessionUnitAsNumber(sessionUnit);
    if (!unitId) {
      setAutoValues({});
      return;
    }

    let cancelled = false;
    setAutoValues({ unit: String(unitId), npaCurrentAc: "" });

    void (async () => {
      let npaId = "";
      try {
        npaId = await fetchFirstCurrentAccountIdForUnit(unitId);
      } catch {
        npaId = "";
      }
      if (!cancelled) {
        setAutoValues({ unit: String(unitId), npaCurrentAc: npaId });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [moduleKey, editingRow, formKey, sessionRole, sessionUnit]);

  const entryFieldUiOverrides = useMemo(() => {
    if (!isAccountsAssetsInvestmentsModule(moduleKey)) return null;
    return {
      npaCurrentAc: {
        lookup: {
          extraLovParams: npaCurrentAcLookupExtraParams(sessionRole, sessionUnit)
        }
      },
      inFavourOf: { inputKey: `inFavourOf-${inFavourOfInputKey}` }
    };
  }, [moduleKey, sessionRole, sessionUnit, inFavourOfInputKey]);

  const entryReadOnlyFields = useMemo(() => {
    if (!isAccountsAssetsInvestmentsModule(moduleKey)) return null;
    if (Number(sessionRole) !== UNIT_RESTRICT_ROLE) return null;
    return { unit: true, npaCurrentAc: true };
  }, [moduleKey, sessionRole]);

  /**
   * Cash clears NPA; switching back to non-cash refills first active current AC for the unit (role 2 or admin with unit in state).
   */
  function handleFieldValueChange(fieldName, value, label) {
    // Cash clears NPA; other payment modes refill the unit’s first current account when possible.
    if (!isAccountsAssetsInvestmentsModule(moduleKey)) return false;
    if (
      handlePartyInFavourOfAutoFill(
        fieldName,
        "paidTo",
        value,
        setAutoValues,
        () => setInFavourOfInputKey((k) => k + 1),
        label
      )
    ) {
      return false;
    }
    if (fieldName === "unit" && Number(sessionRole) !== UNIT_RESTRICT_ROLE) {
      setAutoValues((prev) => ({ ...prev, unit: String(value ?? "").trim() }));
      return false;
    }
    if (fieldName === "paymentMode") {
      const pm = String(value ?? "").trim().toLowerCase();
      if (pm === "cash") {
        setAutoValues((prev) => ({ ...prev, npaCurrentAc: "" }));
        return false;
      }
      setAutoValues((prev) => {
        const fromMerged = sessionUnitAsNumber(prev.unit);
        const fromSession =
          Number(sessionRole) === UNIT_RESTRICT_ROLE ? sessionUnitAsNumber(sessionUnit) : null;
        const unitId = fromMerged ?? fromSession;
        if (unitId) {
          void fetchFirstCurrentAccountIdForUnit(unitId).then((id) =>
            setAutoValues((p) => ({ ...p, npaCurrentAc: id || "" }))
          );
        }
        return prev;
      });
    }
    return false;
  }

  return {
    autoValues,
    entryFieldUiOverrides,
    entryReadOnlyFields,
    handleFieldValueChange
  };
}

