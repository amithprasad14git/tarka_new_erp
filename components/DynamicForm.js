"use client";

/**
 * Config-driven create/edit form: maps `field.type` to inputs (text, email, password, number, date, select, lookup).
 * Lookup fields use LookupSelect (LoV or modal picker per `lookup.ui`).
 */
import { getLookupRowLabelKey } from "../lib/lookupLabelField";
import LookupSelect from "./LookupSelect";

export default function DynamicForm({
  config,
  onSubmit,
  initialValues = {},
  submitLabel = "Save",
  onCancel = null,
  formId = null,
  hideButtons = false,
  className = "card",
  formGridClassName = "form-grid",
  submitDisabled = false
}) {
  return (
    <form
      id={formId || undefined}
      onSubmit={onSubmit}
      className={className}
      style={{ marginBottom: "12px" }}
    >
      <div className={formGridClassName}>
        {(config.fields || []).filter((f) => !f.excludeFromForm).map((f) => (
          <div key={f.name} className="form-field">
            <label htmlFor={`field-${f.name}`}>{f.label}</label>
            {f.type === "lookup" && f.lookup ? (
              <LookupSelect
                id={`field-${f.name}`}
                name={f.name}
                fieldLabel={f.label}
                lookup={f.lookup}
                initialValue={initialValues?.[f.name]}
                initialLabel={initialValues?.[getLookupRowLabelKey(f)]}
                required={Boolean(f.required)}
              />
            ) : f.type === "select" && Array.isArray(f.options) ? (
              <select
                id={`field-${f.name}`}
                name={f.name}
                // For selects, we prefer:
                // 1) `initialValues` (editing)
                // 2) `f.default` (module config default)
                // 3) empty string (create / no default)
                defaultValue={
                  initialValues?.[f.name] != null && initialValues?.[f.name] !== ""
                    ? String(initialValues[f.name])
                    : f.default != null
                      ? String(f.default)
                      : ""
                }
                required={Boolean(f.required)}
              >
                {f.options.map((opt) => (
                  <option key={String(opt.value)} value={String(opt.value)}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : f.type === "date" ? (
              <input
                id={`field-${f.name}`}
                name={f.name}
                type="date"
                // Keep date inputs compatible with the browser: use `YYYY-MM-DD`.
                defaultValue={
                  initialValues?.[f.name]
                    ? String(initialValues[f.name]).slice(0, 10)
                    : ""
                }
                required={Boolean(f.required)}
              />
            ) : (
              <input
                id={`field-${f.name}`}
                name={f.name}
                type={f.type === "number" ? "number" : f.type}
                step={f.type === "number" ? "any" : undefined}
                defaultValue={initialValues?.[f.name] ?? ""}
                // Password fields are intentionally not required so edits/new flows
                // can omit password unless the module explicitly enforces it.
                required={Boolean(f.required) && f.type !== "password"}
              />
            )}
          </div>
        ))}
      </div>
      {!hideButtons ? (
        <div style={{ marginTop: "12px" }}>
          <button type="submit" className="btn-primary" disabled={submitDisabled}>
            {submitLabel}
          </button>
          {onCancel ? (
            <button type="button" onClick={onCancel} style={{ marginLeft: "8px" }}>
              Cancel
            </button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
