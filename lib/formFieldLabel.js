/**
 * Required-field marker for config-driven module UI (DynamicForm, grids, etc.).
 * Do not use on standalone pages like login — those keep plain labels.
 */
export function labelWithRequiredMark(label, required) {
  if (label == null || label === "") return null;
  if (!required) return label;
  return (
    <>
      {label}
      <span className="form-required-mark" aria-hidden="true" title="Required">
        {" *"}
      </span>
    </>
  );
}
