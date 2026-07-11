// Shared library helper for reusable application logic.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Required-field marker for config-driven module UI (DynamicForm, grids, etc.).
 * Do not use on standalone pages like login — those keep plain labels.
 */
export function labelWithRequiredMark(label, required) {
  if (label == null || label === "") return null;
  if (!required) return label;
  // Append a visible asterisk for required fields in config-driven forms.
  return (
    <>
      {label}
      <span className="form-required-mark" aria-hidden="true" title="Required">
        {" *"}
      </span>
    </>
  );
}


