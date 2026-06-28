/**
 * Loan Account — browser-only helpers (unit/NPA, payment mode) for `accounts_loan_ac`.
 * Plain-language overview: @see docs/README-accounts-modules.md
 */
// Module-specific file: Loan Account client behaviour (mirror accounts_expense_voucher).

import { useEffect, useMemo, useState } from "react";
import { handlePartyInFavourOfAutoFill } from "./accountsInFavourOfClient";

/** Keep in sync with ACCOUNTS_LOAN_AC_UNIT_RESTRICT_ROLE in accountsLoanAc.js */
const UNIT_RESTRICT_ROLE = 2;

export const ACCOUNTS_LOAN_AC_POST_CREATE_ACK_UI = {
  field: "voucherNo",
  title: "Loan entry saved",
  hint: "Your voucher number is shown below. Continue to enter another record.",
  showPrintPdf: false,
  showCopyButton: false
};

export function isAccountsLoanAcModule(moduleKey) {
  return moduleKey === "accounts_loan_ac";
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
  // When only one active current account exists for the unit, pre-select it on the form.
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

export function useAccountsLoanAcClientModel({
  moduleKey,
  editingRow,
  formKey,
  sessionRole,
  sessionUnit
}) {
  const [autoValues, setAutoValues] = useState({});
  const [inFavourOfInputKey, setInFavourOfInputKey] = useState(0);

  useEffect(() => {
    // Unit operators get unit + default NPA filled on a new loan entry; admins start blank.
    if (!isAccountsLoanAcModule(moduleKey)) {
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
    if (!isAccountsLoanAcModule(moduleKey)) return null;
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
    if (!isAccountsLoanAcModule(moduleKey)) return null;
    if (Number(sessionRole) !== UNIT_RESTRICT_ROLE) return null;
    return { unit: true, npaCurrentAc: true };
  }, [moduleKey, sessionRole]);

  function handleFieldValueChange(fieldName, value) {
    // Cash clears NPA; switching back to card/cheque/UPI refills the unit’s first current account.
    if (!isAccountsLoanAcModule(moduleKey)) return false;
    if (
      handlePartyInFavourOfAutoFill(fieldName, "party", value, setAutoValues, () =>
        setInFavourOfInputKey((k) => k + 1)
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
