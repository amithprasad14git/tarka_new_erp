"use client";

/**
 * Config-driven create/edit form: maps `field.type` to inputs (text, email, password, number, date, select, lookup).
 * Lookup fields use LookupSelect (LoV or modal picker per `lookup.ui`).
 *
 * Fields marked excludeFromForm + displayOnEdit (e.g. Case No) show as read-only text
 * when editing an existing record so users see values the server filled in.
 *
 * IMPORTANT ARCHITECTURE RULE (layman):
 * - This form is generic and shared by many modules.
 * - Keep module-specific business behavior OUT of this file.
 * - If one module needs special layout/labels/rules, define that in its module file
 *   under `lib/modules/` and pass it in via props/helpers.
 */
import { labelWithRequiredMark } from "../lib/formFieldLabel";
import { rowValueForField } from "../lib/gridRowValue";
import { getLookupRowLabelKey } from "../lib/lookupLabelField";
import { getYmdISTFromInstant } from "../lib/istDateTime";
import { toYyyyMmDdForSqlDateField } from "../lib/sqlDateFieldValue";
import { getNciDynamicFormLayoutSections, isNewCaseInwardModule } from "../lib/modules/newCaseInwardClient";
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
  /** Merged onto the root `<form>` (e.g. `{ marginBottom: 0 }` when footer sits inside a parent card). */
  formRootStyle = null,
  formGridClassName = "form-grid",
  submitDisabled = false,
  /** Field name → non-editable (still submitted). Used for session-derived FKs. */
  readOnlyFields = null,
  /** Field name → UI overrides { placeholder?, maxLength?, helperText? }. */
  fieldUiOverrides = null,
  /** Field name → preloaded lookup options array [{id/valueField, _label}] */
  lookupOptionsByField = null,
  /** Field name → true means lookup must not call remote LoV API */
  disableLookupRemoteByField = null,
  onFieldValueChange = null,
  /** TEMP (NCI): main fields in one card; case-status block + `entryFooterContent` in a second card. */
  nciSplitEntryCards = false,
  /** Rendered inside the NCI follow-up card (e.g. Amount Recovered child grid). Must stay within this form. */
  entryFooterContent = null,
  /** Rendered inside the last NCI entry card (Save / View / Clear), with the same top rule as view mode. */
  entryActionsBar = null
}) {
  // Server-only fields to display when viewing/editing a saved row (not on blank “new” form).
  const displayOnEditFields = (config.fields || []).filter(
    (f) => f.excludeFromForm && f.displayOnEdit && initialValues?.id != null && String(initialValues.id).trim() !== ""
  );
  const todayYmd = getYmdISTFromInstant(new Date());
  const isEditingExistingRecord =
    initialValues?.id != null && String(initialValues.id).trim() !== "";
  const allInputFields = (config.fields || []).filter((f) => !f.excludeFromForm);
  const formLayout = isNewCaseInwardModule(moduleKey)
    ? getNciDynamicFormLayoutSections(allInputFields, isEditingExistingRecord)
    : { mainFields: allInputFields, secondarySection: null };
  const nciHasFollowupCard = Boolean(
    nciSplitEntryCards && (formLayout.secondarySection || entryFooterContent)
  );

  function renderEditableField(f, forceRequired = false) {
    // `forceRequired` supports layout adapters that enforce UI-required markers.
    const fieldReadOnly = Boolean(readOnlyFields?.[f.name]);
    const ui = { ...(f.ui || {}), ...(fieldUiOverrides?.[f.name] || {}) };
    const lookupConfig = f.type === "lookup" && f.lookup ? { ...f.lookup, ...(ui.lookup || {}) } : f.lookup;
    const textareaRows = Number.parseInt(String(f.rows ?? ""), 10);
    const useTextarea =
      f.type === "textarea" ||
      (f.type === "text" && Number.isFinite(textareaRows) && textareaRows > 1);
    const hasUiMin = Object.prototype.hasOwnProperty.call(ui, "min");
    const hasUiMax = Object.prototype.hasOwnProperty.call(ui, "max");
    const required = Boolean(f.required || forceRequired);
    // UI overrides (if provided) win over module defaults.
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

    const fieldDomId = `field-${f.name}`;
    const selectDefault =
      f.type === "select"
        ? initialValues?.[f.name] != null && initialValues?.[f.name] !== ""
          ? String(initialValues[f.name])
          : f.default != null && f.default !== ""
            ? String(f.default)
            : ""
        : "";
    const hasFixedSelectDefault =
      f.type === "select" &&
      f.default != null &&
      f.default !== "" &&
      f.default !== "monthStart" &&
      f.default !== "monthEnd" &&
      f.default !== "today";

    return (
      <div key={f.name} className="form-field form-field-outline">
        <div className="form-field-outline-box">
          <label className="form-field-outline-label" htmlFor={fieldDomId}>
            {labelWithRequiredMark(f.label, required)}
          </label>
          <div className="form-field-outline-control">
        {f.type === "lookup" && f.lookup ? (
          <LookupSelect
            id={fieldDomId}
            name={f.name}
            fieldLabel={f.label}
            lookup={lookupConfig}
            preloadedOptions={Array.isArray(lookupOptionsByField?.[f.name]) ? lookupOptionsByField[f.name] : null}
            disableRemoteFetch={Boolean(disableLookupRemoteByField?.[f.name])}
            initialValue={initialValues?.[f.name]}
            initialLabel={initialValues?.[getLookupRowLabelKey(f)]}
            required={required}
            disabled={fieldReadOnly}
            onValueChange={(nextValue, nextLabel) => {
              if (typeof onFieldValueChange === "function") {
                onFieldValueChange(f.name, nextValue, nextLabel);
              }
            }}
          />
        ) : f.type === "select" && Array.isArray(f.options) ? (
          <>
            {fieldReadOnly ? (
              <input
                type="hidden"
                name={f.name}
                value={selectDefault}
                required={required}
              />
            ) : null}
            <select
              id={fieldDomId}
              name={fieldReadOnly ? undefined : f.name}
              defaultValue={selectDefault}
              required={!fieldReadOnly && required}
              disabled={fieldReadOnly}
              onChange={(e) => {
                if (typeof onFieldValueChange === "function") onFieldValueChange(f.name, e.target.value);
              }}
            >
              {!hasFixedSelectDefault ? (
                <option value="">
                  {ui.emptyOptionLabel != null && String(ui.emptyOptionLabel).trim() !== ""
                    ? String(ui.emptyOptionLabel).trim()
                    : required
                      ? "Select…"
                      : "—"}
                </option>
              ) : null}
              {f.options.map((opt) => (
                <option key={String(opt.value)} value={String(opt.value)}>
                  {opt.label}
                </option>
              ))}
            </select>
          </>
        ) : useTextarea ? (
          <textarea
            key={ui.inputKey ?? fieldDomId}
            id={fieldDomId}
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
            id={fieldDomId}
            name={f.name}
            defaultValue={initialValues?.[f.name] ?? ""}
            required={required}
            readOnly={fieldReadOnly}
            onRawValueChange={ui.onRawValueChange}
            onBlur={ui.onBlur}
          />
        ) : f.type === "month" ? (
          <input
            id={fieldDomId}
            name={f.name}
            type="month"
            defaultValue={
              initialValues?.[f.name] != null && initialValues[f.name] !== ""
                ? String(initialValues[f.name])
                : ""
            }
            required={required}
            readOnly={fieldReadOnly}
            onChange={(e) => {
              if (typeof onFieldValueChange === "function") onFieldValueChange(f.name, e.target.value);
            }}
          />
        ) : f.type === "date" ? (
          <input
            id={fieldDomId}
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
            key={ui.inputKey ?? fieldDomId}
            id={fieldDomId}
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
          </div>
        </div>
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
      className={nciSplitEntryCards ? "master-nci-split-form" : undefined}
      onSubmit={onSubmit}
      style={{
        marginBottom: "12px",
        ...(formRootStyle || {})
      }}
    >
      {nciSplitEntryCards ? (
        <div className="card table-section master-nci-entry-card-main">
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
            const rid = `readonly-label-${f.name}`;
            return (
              <div key={`readonly-${f.name}`} className="form-field form-field-outline form-field-outline-readonly">
                <div className="form-field-outline-box" role="group" aria-labelledby={rid}>
                  <span className="form-field-outline-label" id={rid}>
                    {labelWithRequiredMark(f.label, false)}
                  </span>
                  <div className="form-field-outline-control">
                    <div className="form-field-outline-readonly-value" aria-readonly="true">
                      {text}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {formLayout.mainFields.map((f) => renderEditableField(f))}
            </div>
          </div>
          {nciSplitEntryCards && !nciHasFollowupCard && entryActionsBar ? entryActionsBar : null}
        </div>
      ) : (
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
              const rid = `readonly-label-${f.name}`;
              return (
                <div
                  key={`readonly-${f.name}`}
                  className="form-field form-field-outline form-field-outline-readonly"
                >
                  <div className="form-field-outline-box" role="group" aria-labelledby={rid}>
                    <span className="form-field-outline-label" id={rid}>
                      {labelWithRequiredMark(f.label, false)}
                    </span>
                    <div className="form-field-outline-control">
                      <div className="form-field-outline-readonly-value" aria-readonly="true">
                        {text}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {formLayout.mainFields.map((f) => renderEditableField(f))}
          </div>
        </div>
      )}
      {!nciSplitEntryCards && formLayout.secondarySection ? (
        <div className="master-entry-form-case-status table-section" style={{ marginTop: "12px" }}>
          <h2 className="module-child-section-title">{formLayout.secondarySection.title}</h2>
          <div className="form-grid form-grid-master">
            {formLayout.secondarySection.fields.map((f) => renderEditableField(f))}
          </div>
        </div>
      ) : null}
      {nciSplitEntryCards && (formLayout.secondarySection || entryFooterContent) ? (
        <div className="card table-section master-nci-entry-card-followup">
          {formLayout.secondarySection ? (
            <div className="master-entry-form-case-status table-section">
              <h2 className="module-child-section-title">{formLayout.secondarySection.title}</h2>
              <div className="form-grid form-grid-master">
                {formLayout.secondarySection.fields.map((f) => renderEditableField(f))}
              </div>
            </div>
          ) : null}
          {entryFooterContent}
          {nciSplitEntryCards && nciHasFollowupCard && entryActionsBar ? entryActionsBar : null}
        </div>
      ) : null}
      {!hideButtons ? (
        <div style={{ marginTop: "12px" }}>
          {/* Normal reusable form mode: show default Save/Cancel buttons.
              Master screens pass `hideButtons` and render custom action bars instead. */}
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
