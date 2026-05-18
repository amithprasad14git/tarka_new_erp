"use client";

// Generic/shared file used across modules.
// Keep module-specific business logic in lib/modules/<module> files.

import { useEffect, useMemo, useState } from "react";

function groupIndianDigits(digits) {
  if (!digits) return "";
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const leading = digits.slice(0, -3);
  const groupedLeading = leading.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${groupedLeading},${last3}`;
}

function normalizeNumericInput(raw) {
  const text = String(raw ?? "").replace(/,/g, "").trim();
  if (!text) return "";

  const sign = text.startsWith("-") ? "-" : "";
  const unsigned = sign ? text.slice(1) : text;
  const hasDot = unsigned.includes(".");
  const [intRaw, ...fracParts] = unsigned.split(".");
  const intDigits = intRaw.replace(/\D/g, "");
  const fracDigits = fracParts.join("").replace(/\D/g, "");

  if (hasDot) return `${sign}${intDigits}.${fracDigits}`;
  return `${sign}${intDigits}`;
}

function formatInrForDisplay(value) {
  const text = String(value ?? "");
  if (!text) return "";
  if (text === "-" || text === "." || text === "-.") return text;

  const sign = text.startsWith("-") ? "-" : "";
  const unsigned = sign ? text.slice(1) : text;
  const hasDot = unsigned.includes(".");
  const [intPart, fracPart = ""] = unsigned.split(".");

  const groupedInt = groupIndianDigits(intPart);
  if (!hasDot) return `${sign}${groupedInt}`;
  return `${sign}${groupedInt}.${fracPart}`;
}

/** Form number input with Indian grouping in UI and plain numeric submission. */
export default function InrNumberInput({
  id,
  name,
  defaultValue = "",
  required = false,
  readOnly = false,
  disabled = false,
  className = "",
  placeholder = "",
  ariaLabel = undefined,
  onRawValueChange = undefined,
  onBlur = undefined
}) {
  const [rawValue, setRawValue] = useState(() => normalizeNumericInput(defaultValue));

  useEffect(() => {
    setRawValue(normalizeNumericInput(defaultValue));
  }, [defaultValue]);

  const displayValue = useMemo(() => formatInrForDisplay(rawValue), [rawValue]);

  return (
    <>
      {name ? <input type="hidden" name={name} value={rawValue} required={Boolean(required)} /> : null}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        className={className || undefined}
        value={displayValue}
        onChange={(e) => {
          const next = normalizeNumericInput(e.target.value);
          setRawValue(next);
          if (typeof onRawValueChange === "function") onRawValueChange(next);
        }}
        onBlur={typeof onBlur === "function" ? onBlur : undefined}
        readOnly={Boolean(readOnly)}
        disabled={Boolean(disabled)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-readonly={Boolean(readOnly) || undefined}
      />
    </>
  );
}
