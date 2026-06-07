/**
 * accountsCurrentAcTransfer — browser-only behaviour (forms, pickers, Print/download).
 * Server save rules: lib/modules/accountsCurrentAcTransfer.js
 */

// Module-specific file: Current AC Transfer client behaviour (dependent To AC LoV).

import { useEffect, useMemo, useState } from "react";

export function isAccountsCurrentAcTransferModule(moduleKey) {
  return moduleKey === "accounts_current_ac_transfer";
}

/**
 * To Current AC LoV excludes the row selected as From (`exclude_id` on CRUD LoV).
 * When From changes to the same id as To, To is cleared so the user must re-pick.
 */
export function useAccountsCurrentAcTransferClientModel({ moduleKey, editingRow, formKey }) {
  const [autoValues, setAutoValues] = useState({});

  useEffect(() => {
    // Track From/To current accounts so the To picker can exclude the From row.
    if (!isAccountsCurrentAcTransferModule(moduleKey)) {
      setAutoValues({});
      return;
    }
    if (editingRow) {
      setAutoValues({
        fromCurrentAc: editingRow?.fromCurrentAc ?? "",
        toCurrentAc: editingRow?.toCurrentAc ?? ""
      });
      return;
    }
    setAutoValues({ fromCurrentAc: "", toCurrentAc: "" });
  }, [moduleKey, editingRow, formKey]);

  const entryFieldUiOverrides = useMemo(() => {
    if (!isAccountsCurrentAcTransferModule(moduleKey)) return null;
    const fromId = String(autoValues?.fromCurrentAc ?? "").trim();
    const baseActive = { f_active: "Yes" };
    return {
      fromCurrentAc: {
        lookup: { extraLovParams: { ...baseActive } }
      },
      toCurrentAc: {
        lookup: {
          extraLovParams: {
            ...baseActive,
            ...(fromId ? { exclude_id: fromId } : {})
          }
        }
      }
    };
  }, [moduleKey, autoValues?.fromCurrentAc]);

  function handleFieldValueChange(fieldName, value) {
    if (!isAccountsCurrentAcTransferModule(moduleKey)) return false;
    if (fieldName === "fromCurrentAc") {
      const nextFrom = String(value ?? "").trim();
      setAutoValues((prev) => {
        const toPrev = String(prev.toCurrentAc ?? "").trim();
        return {
          ...prev,
          fromCurrentAc: nextFrom,
          toCurrentAc: toPrev !== "" && nextFrom !== "" && toPrev === nextFrom ? "" : prev.toCurrentAc
        };
      });
      return true;
    }
    if (fieldName === "toCurrentAc") {
      setAutoValues((prev) => ({ ...prev, toCurrentAc: String(value ?? "").trim() }));
      return true;
    }
    return false;
  }

  return {
    autoValues,
    entryFieldUiOverrides,
    entryReadOnlyFields: null,
    handleFieldValueChange
  };
}

