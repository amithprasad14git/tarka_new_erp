// Module-specific file: contains business rules for this module only.
// Do not move this logic into generic/shared files.

import { useEffect, useMemo, useState } from "react";
import { getYmdISTFromInstant } from "../istDateTime";

/**
 * Transfer Case client behavior in one place.
 * Keeps Transfer Case UI logic out of generic component files.
 */
export function isTransferCaseModule(moduleKey) {
  return moduleKey === "transfer_case";
}

export function isTransferCaseSnapshotModule(moduleKey) {
  return isTransferCaseModule(moduleKey);
}

export function useTransferCaseClientModel({ moduleKey, editingRow, formKey }) {
  const [autoValues, setAutoValues] = useState({});

  useEffect(() => {
    if (!isTransferCaseModule(moduleKey)) {
      setAutoValues({});
      return;
    }
    if (editingRow) {
      setAutoValues({
        fromUnit: editingRow?.fromUnit ?? "",
        fromUnitLabel: editingRow?.fromUnitLabel ?? "",
        toUnit: editingRow?.toUnit ?? "",
        assignee: editingRow?.assignee ?? ""
      });
      return;
    }
    setAutoValues({});
  }, [moduleKey, editingRow, formKey]);

  const entryFieldUiOverrides = useMemo(() => {
    if (!isTransferCaseModule(moduleKey)) return null;
    const fromUnit = String(autoValues?.fromUnit ?? "").trim();
    const toUnit = String(autoValues?.toUnit ?? "").trim();
    const todayYmd = getYmdISTFromInstant(new Date());
    return {
      date: {
        min: todayYmd,
        max: todayYmd,
        helperText: "Only today's date is allowed."
      },
      toUnit: {
        lookup: fromUnit ? { extraLovParams: { exclude_id: fromUnit } } : {}
      },
      assignee: {
        lookup: toUnit ? { extraLovParams: { f_unit: toUnit } } : {},
        helperText: toUnit
          ? "Only users mapped to selected To Unit are shown."
          : "Select To Unit to load assignee list."
      }
    };
  }, [moduleKey, autoValues?.fromUnit, autoValues?.toUnit]);

  function handleFieldValueChange(fieldName, value) {
    if (!isTransferCaseModule(moduleKey)) return false;
    if (fieldName === "toUnit") {
      setAutoValues((prev) => ({
        ...prev,
        toUnit: value,
        assignee: "",
        assigneeLabel: ""
      }));
      return true;
    }
    if (fieldName === "assignee") {
      setAutoValues((prev) => ({ ...prev, assignee: value }));
      return true;
    }
    if (fieldName !== "caseNo") return false;
    setAutoValues((prev) => ({
      ...prev,
      toUnit: "",
      assignee: "",
      assigneeLabel: "",
      fromUnit: "",
      fromUnitLabel: ""
    }));
    const caseId = Number(value);
    if (!Number.isFinite(caseId) || caseId <= 0) return true;
    void (async () => {
      try {
        const res = await fetch(`/api/crud/new_case_inward/${caseId}`);
        const payload = await res.json();
        const fromUnit = String(payload?.data?.unit ?? "").trim();
        const fromUnitLabel = String(payload?.data?.unitLabel ?? "").trim();
        setAutoValues((prev) => ({
          ...prev,
          fromUnit: fromUnit || "",
          fromUnitLabel: fromUnitLabel || ""
        }));
      } catch {
        setAutoValues((prev) => ({ ...prev, fromUnit: "", fromUnitLabel: "" }));
      }
    })();
    return true;
  }

  return {
    autoValues,
    entryFieldUiOverrides,
    entryReadOnlyFields: isTransferCaseModule(moduleKey) ? { fromUnit: true } : null,
    handleFieldValueChange
  };
}
