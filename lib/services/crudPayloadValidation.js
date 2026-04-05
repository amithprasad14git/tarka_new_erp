/**
 * =============================================================================
 * CRUD PAYLOAD VALIDATION — “Is the form filled in correctly?”
 * =============================================================================
 * Before the database saves anything, we double-check the incoming data against
 * the field definitions in config/modules.js. Think of it like a paper form with
 * rules: required boxes must be filled, numbers must be numbers, emails must look
 * like emails, dropdowns must pick a real option, dates must be real calendar dates.
 *
 * Two modes:
 * - **create**: Every field marked `required` (and not server-only) must be present
 *   with a real value. Also every field the client sent is type-checked.
 * - **update**: The user may send only some fields (partial save). We only validate
 *   what they sent. If they try to clear a required field to empty, we reject that.
 *
 * Return value: `null` means “all good”. Otherwise a single human-readable string
 * explaining the first problem (so the API can return `{ error: that string }`).
 * =============================================================================
 */

// Simple pattern for “something@something.something” — not perfect but catches obvious typos.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Picks the friendly label for error messages (falls back to the technical field name).
 */
function fieldLabel(field) {
  return field.label || field.name;
}

/**
 * Decides if a value counts as “empty” for required checks and for skipping type checks.
 * Example: empty string, null, or a lookup id that is not a real number = empty.
 */
function isEmptyValue(value, field) {
  if (value === undefined || value === null) return true;
  const t = field.type;
  if (t === "lookup") {
    if (value === "") return true;
    return !Number.isFinite(Number(value));
  }
  if (t === "number") {
    if (value === "") return true;
    return !Number.isFinite(Number(value));
  }
  if (t === "text" || t === "email" || t === "password") {
    return String(value).trim() === "";
  }
  if (t === "date") {
    return value === "" || (typeof value === "string" && String(value).trim() === "");
  }
  if (t === "select") {
    return value === "" || value === null || value === undefined;
  }
  return false;
}

/**
 * Checks a calendar date string YYYY-MM-DD is real (not Feb 31, etc.).
 * Returns true/false only.
 */
function isValidDateString(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * When the value is not empty, make sure its *shape* matches the field type.
 * Returns `null` if OK, or a short error sentence for the user.
 */
function validateFieldFormat(field, value) {
  const t = field.type;
  const label = fieldLabel(field);

  if (t === "text" || t === "password") {
    if (typeof value === "object" && value !== null) {
      return `Invalid value for "${label}".`;
    }
    return null;
  }
  if (t === "email") {
    if (typeof value !== "string" || !EMAIL_RE.test(value.trim())) {
      return `"${label}" must be a valid email address.`;
    }
    return null;
  }
  if (t === "number") {
    if (!Number.isFinite(Number(value))) {
      return `"${label}" must be a number.`;
    }
    return null;
  }
  if (t === "date") {
    if (typeof value !== "string" || !isValidDateString(value)) {
      return `"${label}" must be a date in YYYY-MM-DD format.`;
    }
    return null;
  }
  if (t === "select") {
    const opts = field.options || [];
    const ok = opts.some((o) => Object.is(o.value, value) || String(o.value) === String(value));
    if (!ok) {
      return `"${label}" must be one of the allowed options.`;
    }
    return null;
  }
  if (t === "lookup") {
    if (!Number.isFinite(Number(value))) {
      return `"${label}" must be a valid lookup id.`;
    }
    return null;
  }
  return null;
}

/**
 * Main entry: validate a slice of data about to be written.
 *
 * Parameters (plain English):
 * - moduleConfig — the module’s field list from config/modules.js.
 * - data — object containing only the keys we care about (e.g. fields being inserted).
 * - mode — "create" or "update" (rules differ slightly).
 * - keysInRequest — list of field names the client is trying to write in this request.
 *
 * Returns: `null` if valid, otherwise one error string.
 */
export function validateCrudPayloadForWrite(moduleConfig, data, mode, keysInRequest) {
  const fields = moduleConfig.fields || [];
  const byName = Object.fromEntries(fields.map((f) => [f.name, f]));

  if (mode === "create") {
    // First pass: every required editable field must appear with a non-empty value.
    for (const f of fields) {
      if (f.excludeFromForm || !f.required) continue;
      const v = data[f.name];
      if (!Object.prototype.hasOwnProperty.call(data, f.name) || isEmptyValue(v, f)) {
        return `${fieldLabel(f)} is required.`;
      }
    }
    // Second pass: type-check everything we are inserting (required or optional).
    for (const key of keysInRequest) {
      const f = byName[key];
      if (!f || f.excludeFromForm) continue;
      const v = data[key];
      if (isEmptyValue(v, f)) {
        if (!f.required) continue;
        return `${fieldLabel(f)} is required.`;
      }
      const err = validateFieldFormat(f, v);
      if (err) return err;
    }
    return null;
  }

  // UPDATE: only validate keys the client actually sent.
  for (const key of keysInRequest) {
    const f = byName[key];
    if (!f || f.excludeFromForm) continue;
    const v = data[key];
    if (isEmptyValue(v, f)) {
      if (f.required) {
        return `${fieldLabel(f)} cannot be empty.`;
      }
      continue;
    }
    const err = validateFieldFormat(f, v);
    if (err) return err;
  }
  return null;
}
