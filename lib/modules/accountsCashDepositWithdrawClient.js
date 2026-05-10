// Module-specific file: client-side behaviour for Cash Deposit / Withdraw only.

import { useEffect, useMemo, useState } from "react";

/** Keep in sync with ACCOUNTS_CASH_DEPOSIT_WITHDRAW_UNIT_RESTRICT_ROLE in accountsCashDepositWithdraw.js */
const UNIT_RESTRICT_ROLE = 2;

export function isAccountsCashDepositWithdrawModule(moduleKey) {
  return moduleKey === "accounts_cash_deposit_withdraw";
}

function sessionUnitAsNumber(sessionUnit) {
  const u = Number(sessionUnit != null ? String(sessionUnit).trim() : NaN);
  return Number.isFinite(u) && u > 0 ? u : null;
}

function npaCurrentAcLookupExtraParams(sessionRole, sessionUnit) {
  const base = { f_active: "Yes" };
  if (Number(sessionRole) !== UNIT_RESTRICT_ROLE) return base;
  const u = sessionUnitAsNumber(sessionUnit);
  if (!u) return base;
  return { ...base, f_unit: String(u) };
}

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
 * Role 2: auto unit + npa Current AC from session / first account for unit; readonly.
 */
export function useAccountsCashDepositWithdrawClientModel({
  moduleKey,
  editingRow,
  formKey,
  sessionRole,
  sessionUnit
}) {
  const [autoValues, setAutoValues] = useState({});

  useEffect(() => {
    if (!isAccountsCashDepositWithdrawModule(moduleKey)) {
      setAutoValues({});
      return;
    }

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
    if (!isAccountsCashDepositWithdrawModule(moduleKey)) return null;
    return {
      npaCurrentAc: {
        lookup: {
          extraLovParams: npaCurrentAcLookupExtraParams(sessionRole, sessionUnit)
        }
      }
    };
  }, [moduleKey, sessionRole, sessionUnit]);

  const entryReadOnlyFields = useMemo(() => {
    if (!isAccountsCashDepositWithdrawModule(moduleKey)) return null;
    if (Number(sessionRole) !== UNIT_RESTRICT_ROLE) return null;
    return { unit: true, npaCurrentAc: true };
  }, [moduleKey, sessionRole]);

  function handleFieldValueChange(fieldName, _value) {
    if (!isAccountsCashDepositWithdrawModule(moduleKey)) return false;
    void fieldName;
    return false;
  }

  return {
    autoValues,
    entryFieldUiOverrides,
    entryReadOnlyFields,
    handleFieldValueChange
  };
}
