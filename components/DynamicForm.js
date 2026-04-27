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
import { getYmdISTFromInstant } from "../lib/istDateTime";
import { toYyyyMmDdForSqlDateField } from "../lib/sqlDateFieldValue";
import InrNumberInput from "./InrNumberInput";
import LookupSelect from "./LookupSelect";

export default function DynamicForm({
  moduleKey = null,
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
  readOnlyFields = null,
  /** Field name → UI overrides { placeholder?, maxLength?, helperText? }. */
  fieldUiOverrides = null,
  onFieldValueChange = null
}) {
  // Server-only fields to display when viewing/editing a saved row (not on blank “new” form).
  const displayOnEditFields = (config.fields || []).filter(
    (f) => f.excludeFromForm && f.displayOnEdit && initialValues?.id != null && String(initialValues.id).trim() !== ""
  );
  const todayYmd = getYmdISTFromInstant(new Date());
  const isEditingExistingRecord =
    initialValues?.id != null && String(initialValues.id).trim() !== "";
  const nciCaseStatusFieldNames = new Set(["caseStatus", "caseStatusUpdatedDate", "caseStatusRemarks"]);
  const allInputFields = (config.fields || []).filter((f) => !f.excludeFromForm);
  const useNciCaseStatusSection = moduleKey === "new_case_inward" && isEditingExistingRecord;
  const mainInputFields = useNciCaseStatusSection
    ? allInputFields.filter((f) => !nciCaseStatusFieldNames.has(f.name))
    : allInputFields;
  const caseStatusUpdateFields = useNciCaseStatusSection
    ? allInputFields.filter((f) => nciCaseStatusFieldNames.has(f.name))
    : [];
  const renderSeparateNciCaseStatusCard = useNciCaseStatusSection && caseStatusUpdateFields.length > 0;

  function renderEditableField(f, forceRequired = false) {
    const fieldReadOnly = Boolean(readOnlyFields?.[f.name]);
    const ui = fieldUiOverrides?.[f.name] || {};
    const textareaRows = Number.parseInt(String(f.rows ?? ""), 10);
    const useTextarea =
      f.type === "textarea" ||
      (f.type === "text" && Number.isFinite(textareaRows) && textareaRows > 1);
    const hasUiMin = Object.prototype.hasOwnProperty.call(ui, "min");
    const hasUiMax = Object.prototype.hasOwnProperty.call(ui, "max");
    const required = Boolean(f.required || forceRequired);
    const resolvedMin =
      hasUiMin && ui.min != null && String(ui.min).trim() !== "" ? String(ui.min).trim() : undefined;
    const resolvedMax = hasUiMax
      ? ui.max != null && String(ui.max).trim() !== ""
        ? String(ui.max).trim()
        : undefined
      : f.maxToday
        ? todayYmd
        : undefined;
    // If a custom max is not provided, date fields with `maxToday: true` automatically
    // use today's date as max. This keeps "future date not allowed" simple in modules.js.

    return (
      <div key={f.name} className="form-field">
        <label htmlFor={`field-${f.name}`}>
          {labelWithRequiredMark(f.label, required)}
        </label>
        {f.type === "lookup" && f.lookup ? (
          <LookupSelect
            id={`field-${f.name}`}
            name={f.name}
            fieldLabel={f.label}
            lookup={f.lookup}
            initialValue={initialValues?.[f.name]}
            initialLabel={initialValues?.[getLookupRowLabelKey(f)]}
            required={required}
            disabled={fieldReadOnly}
            onValueChange={(nextValue) => {
              if (typeof onFieldValueChange === "function") onFieldValueChange(f.name, nextValue);
            }}
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
                required={required}
              />
            ) : null}
            <select
              id={`field-${f.name}`}
              name={fieldReadOnly ? undefined : f.name}
              defaultValue={
                initialValues?.[f.name] != null && initialValues?.[f.name] !== ""
                  ? String(initialValues[f.name])
                  : f.default != null
                    ? String(f.default)
                    : ""
              }
              required={!fieldReadOnly && required}
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
            required={required}
            readOnly={fieldReadOnly}
            placeholder={ui.placeholder || undefined}
            maxLength={ui.maxLength != null ? Number(ui.maxLength) : undefined}
            onChange={(e) => {
              if (typeof onFieldValueChange === "function") onFieldValueChange(f.name, e.target.value);
            }}
          />
        ) : f.type === "number" ? (
          <InrNumberInput
            id={`field-${f.name}`}
            name={f.name}
            defaultValue={initialValues?.[f.name] ?? ""}
            required={required}
            readOnly={fieldReadOnly}
          />
        ) : f.type === "date" ? (
          <input
            id={`field-${f.name}`}
            name={f.name}
            type="date"
            defaultValue={
              initialValues?.[f.name] != null && initialValues[f.name] !== ""
                ? toYyyyMmDdForSqlDateField(initialValues[f.name])
                : f.defaultTodayOnEdit &&
                    initialValues?.id != null &&
                    String(initialValues.id).trim() !== ""
                  ? todayYmd
                  : ""
            }
            required={required}
            readOnly={fieldReadOnly}
            min={resolvedMin}
            max={resolvedMax}
            onChange={(e) => {
              let nextValue = e.target.value;
              // Native date pickers still allow selecting out-of-range days in some browsers/OS themes.
              // Enforce range immediately so transaction-control limits feel strict in the UI.
              if (nextValue && resolvedMin && nextValue < resolvedMin) {
                nextValue = resolvedMin;
                e.target.value = nextValue;
              } else if (nextValue && resolvedMax && nextValue > resolvedMax) {
                nextValue = resolvedMax;
                e.target.value = nextValue;
              }
              if (typeof onFieldValueChange === "function") onFieldValueChange(f.name, nextValue);
            }}
          />
        ) : (
          <input
            id={`field-${f.name}`}
            name={f.name}
            type={f.type}
            defaultValue={initialValues?.[f.name] ?? ""}
            required={required && f.type !== "password"}
            readOnly={fieldReadOnly}
            placeholder={ui.placeholder || undefined}
            maxLength={ui.maxLength != null ? Number(ui.maxLength) : undefined}
            onChange={(e) => {
              if (typeof onFieldValueChange === "function") onFieldValueChange(f.name, e.target.value);
            }}
          />
        )}
        {ui.helperText ? (
          <div
            className={`form-field-hint${ui.helperTone === "error" ? " form-field-hint-error" : ""}`}
          >
            {String(ui.helperText)}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form
      id={formId || undefined}
      onSubmit={onSubmit}
      style={{ marginBottom: "12px" }}
    >
      <div className={className}>
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
          {mainInputFields.map((f) => renderEditableField(f))}
        </div>
      </div>
      {renderSeparateNciCaseStatusCard ? (
        <div className="card master-entry-form-case-status" style={{ marginTop: "12px" }}>
          <h2 className="module-child-section-title">Case Status Update</h2>
          <div className="form-grid form-grid-master">
            {caseStatusUpdateFields.map((f) => renderEditableField(f, true))}
          </div>
        </div>
      ) : null}
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
