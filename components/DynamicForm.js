"use client";

/**
 * Config-driven create/edit form: maps `field.type` to inputs (text, email, password, number, date, select, lookup).
 * Lookup fields use LookupSelect (LoV or modal picker per `lookup.ui`).
 *
 * Fields marked excludeFromForm + displayOnEdit (e.g. Case No) show as read-only text
 * when editing an existing record so users see values the server filled in.
 */
import { labelWithRequiredMark } from "../lib/formFieldLabel";
import { rowValueForField } from "../lib/gridRowValue";
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
  submitDisabled = false,
  /** Field name → non-editable (still submitted). Used for session-derived FKs. */
  readOnlyFields = null
}) {
  // Server-only fields to display when viewing/editing a saved row (not on blank “new” form).
  const displayOnEditFields = (config.fields || []).filter(
    (f) => f.excludeFromForm && f.displayOnEdit && initialValues?.id != null && String(initialValues.id).trim() !== ""
  );

  return (
    <form
      id={formId || undefined}
      onSubmit={onSubmit}
      className={className}
      style={{ marginBottom: "12px" }}
    >
      <div className={formGridClassName}>
        {displayOnEditFields.map((f) => {
          const raw =
            f.type === "lookup" && f.lookup
              ? rowValueForField(initialValues, getLookupRowLabelKey(f)) ??
                rowValueForField(initialValues, f.name)
              : rowValueForField(initialValues, f.name);
          const text =
            raw != null && String(raw).trim() !== "" ? String(raw) : "—";
          return (
            <div key={`readonly-${f.name}`} className="form-field">
              <span className="form-field-readonly-label">{f.label}</span>
              <div className="form-field-readonly-value" aria-readonly="true">
                {text}
              </div>
            </div>
          );
        })}
        {(config.fields || []).filter((f) => !f.excludeFromForm).map((f) => {
          const fieldReadOnly = Boolean(readOnlyFields?.[f.name]);
          const textareaRows = Number.parseInt(String(f.rows ?? ""), 10);
          const useTextarea =
            f.type === "textarea" ||
            (f.type === "text" && Number.isFinite(textareaRows) && textareaRows > 1);
          return (
          <div key={f.name} className="form-field">
            <label htmlFor={`field-${f.name}`}>
              {labelWithRequiredMark(f.label, Boolean(f.required))}
            </label>
            {f.type === "lookup" && f.lookup ? (
              <LookupSelect
                id={`field-${f.name}`}
                name={f.name}
                fieldLabel={f.label}
                lookup={f.lookup}
                initialValue={initialValues?.[f.name]}
                initialLabel={initialValues?.[getLookupRowLabelKey(f)]}
                required={Boolean(f.required)}
                disabled={fieldReadOnly}
              />
            ) : f.type === "select" && Array.isArray(f.options) ? (
              <>
                {fieldReadOnly ? (
                  <input
                    type="hidden"
                    name={f.name}
                    value={
                      initialValues?.[f.name] != null && initialValues?.[f.name] !== ""
                        ? String(initialValues[f.name])
                        : f.default != null
                          ? String(f.default)
                          : ""
                    }
                    required={Boolean(f.required)}
                  />
                ) : null}
                <select
                  id={`field-${f.name}`}
                  name={fieldReadOnly ? undefined : f.name}
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
                  required={!fieldReadOnly && Boolean(f.required)}
                  disabled={fieldReadOnly}
                >
                  {f.options.map((opt) => (
                    <option key={String(opt.value)} value={String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </>
            ) : useTextarea ? (
              <textarea
                id={`field-${f.name}`}
                name={f.name}
                rows={Number.isFinite(textareaRows) && textareaRows > 1 ? textareaRows : 3}
                defaultValue={initialValues?.[f.name] ?? ""}
                required={Boolean(f.required)}
                readOnly={fieldReadOnly}
              />
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
                readOnly={fieldReadOnly}
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
                readOnly={fieldReadOnly}
              />
            )}
          </div>
          );
        })}
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
