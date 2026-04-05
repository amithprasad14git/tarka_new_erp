/**
 * =============================================================================
 * WHAT IS THIS FILE? (Read this first if you do not code)
 * =============================================================================
 * This file is the “menu” and “blueprint” for the whole ERP data-entry system.
 * Think of each entry below (users, employee_master, etc.) as one screen in the
 * app: a list of records you can add, view, edit, or delete.
 *
 * - The **key** (e.g. `employee_master`) becomes part of the web address and is
 *   how the server knows which table and which permissions apply.
 * - **`table`** is the real name of the database table where rows are stored.
 * - **`fields`** describe each column: label shown to people, type of data, and
 *   extra rules (required, lookup to another module, etc.).
 *
 * How this connects to the rest of the project:
 * - The sidebar and dashboard read these keys to show menu items.
 * - The generic CRUD API (`/api/crud/...`) reads this file to know which columns
 *   to list, validate, insert, and update.
 * - Permissions (“can this user open Employees?”) use the same key in the
 *   database table `user_permissions`.
 *
 * Special flags you will see on fields:
 * - **excludeFromForm**: The form does not let people type this; the server fills
 *   it automatically (like “who created this row” and “when”).
 * - **showInView**: Whether the column appears in the “view saved data” grid.
 * - **required**: On create, the user must supply a value; on update, they cannot
 *   clear it to empty if they touch that field.
 * - **lookup**: Instead of typing an ID number, the user picks a row from another
 *   module (e.g. pick a Unit from Unit Master). Like a dropdown wired to another list.
 * - **Row-level access (not configured here):** For every module, the app always applies
 *   the per-user scopes in `user_permissions` (view_scope, edit_scope, delete_scope: own,
 *   unit, or all). See lib/rowScope.js — you cannot turn this off from modules.js.
 * - **readOnly**: The screen can show data but cannot create/update/delete through
 *   the generic API (used for Audit Logs).
 * - **lookupDisplayField**: When searching or showing labels for this module in lists,
 *   which column text is used (e.g. employee name).
 *
 * Lookup vs select:
 * - **select**: Fixed choices in config (Yes/No).
 * - **lookup**: Choices come from another module’s table (another “screen” of data).
 *
 * Technical notes (for developers) are still valid below; layman explanations are
 * added in plain language next to each module and where helpful.
 * =============================================================================
 *
 * Registry for generic CRUD + sidebar: keys become `/dashboard/:key` and API module names.
 * Each table must exist in MySQL; RBAC uses the same key in `user_permissions.module`.
 * List: per-column `f_<field>` filters; optional `?search=` when the module sets `lookupDisplayField`.
 *
 * Per-field `showInView` (optional, default true):
 * - `true` — column appears in the "View saved data" table (and gets a header filter).
 * - `false` — hidden from the view table only; still on the entry form if listed in `fields`.
 *
 * `users`: login identity (id PK, fullName, email, password, role, unit, active) plus the same four
 * row-audit columns as every other table. Only `active = Yes` (case-insensitive) may log in;
 * `getSessionUser` drops sessions for inactive users.
 *
 * Standard row metadata (same four columns on each business table that has them in MySQL):
 * createdBy, createdDate, modifiedBy, modifiedDate — list them like any other field.
 * Use `excludeFromForm: true` so the API fills them (users cannot edit from the form).
 * Use `showInView: false` to hide them in the view grid, or `true` to show them.
 * When all four names exist on a module, POST/PUT apply values server-side (see lib/crudRecordAudit.js).
 *
 * Row scope on `user_permissions`: `view_scope`, `edit_scope`, `delete_scope` — each `own` | `unit` |
 * `all`. Create has no scope (`can_create` only). Enforced in `lib/rowScope.js` / `lib/rbac.js`. Requires `users.unit` for unit scope.
 * **Unit:** match logged-in `users.unit` to the **`users.unit`** of the account in **`createdBy`** (not row `unit` FKs).
 *
 * Lookup fields (`type: "lookup"`):
 * - `lookup.module`, `valueField`, optional `labelField` (else referenced module’s `lookupDisplayField`).
 * - On each referenced module set **`lookupDisplayField`**: the DB column used for LoV/picker label, list `?search=`,
 *   FK text filters, and enrich (one column). Optional `lookup.searchField` overrides **only** the FK filter WHERE column.
 * - Optional **`displayKey`** on the field: JSON key for the enriched label on list rows; if omitted, defaults to
 *   `{fieldName}Label` (e.g. `unit` → `unitLabel`). Audit fields may keep custom keys like `createdBy_fullName`.
 *
 * How to choose LoV vs popup (per field):
 * - List of values (dropdown `<select>`, up to 500 rows): omit `lookup.ui`, or set
 *   `lookup.ui` to `"lov"` | `"dropdown"` | `"select"` | `"list"`.
 * - Popup picker (search + table + double-click): `lookup.ui` =
 *   `"picker"` | `"popup"` | `"modal"` | `"dialog"`.
 * - Optional: `lookup.pickerLimit` (default 20, max 100), `lookup.pickerSortBy` (server sort column; default `labelField`).
 * - Popup columns: `lookup.pickerColumns`: `[{ field: "name", header: "Name" }, { field: "email", header: "Email" }]`.
 *   `field` must match a column returned by the referenced module’s list API. If omitted, one column (`labelField`) is shown.
 */

// -----------------------------------------------------------------------------
// Reusable “who did it / when” fields (like a stamp on every business record)
// -----------------------------------------------------------------------------
// These four fields appear on many tables. They answer: who created the row, when,
// who last changed it, and when. People never type them on the form (excludeFromForm);
// the server sets them on create/update. Lookups point at the Users module so lists
// can show a person’s name instead of a raw user id number.
const STANDARD_ROW_AUDIT_FIELDS = [
  {
    // Links to users.id; label shows fullName in lists via displayKey.
    name: "createdBy",
    type: "lookup",
    label: "Created by",
    excludeFromForm: true,
    showInView: true,
    lookup: { module: "users", valueField: "id", labelField: "fullName" },
    displayKey: "createdBy_fullName"
  },
  // Stored as text in list responses (often formatted for display).
  { name: "createdDate", type: "text", label: "Created Date", excludeFromForm: true, showInView: true },
  {
    name: "modifiedBy",
    type: "lookup",
    label: "Modified by",
    excludeFromForm: true,
    showInView: false,
    lookup: { module: "users", valueField: "id", labelField: "fullName" },
    displayKey: "modifiedBy_fullName"
  },
  { name: "modifiedDate", type: "text", label: "Modified Date", excludeFromForm: true, showInView: false }
];

// All screens/modules the ERP knows about. Key = internal name; value = settings + fields.
export const modules = {

  // ---------------------------------------------------------------------------
  // USERS — Login accounts (who can sign in)
  // ---------------------------------------------------------------------------
  // Represents people who use the system: name, email, password, role, which
  // business unit they belong to, and whether the account is active. Only users
  // with Active = Yes can stay logged in (see lib/auth.js and lib/session.js).
  // lib/rowScope.js has a special case for the users table under “own” scope so people
  // can still open their own login row even if someone else created the record.
  users: {
    label: "Users",
    icon: "👨‍💻",
    group: "Administration",
    table: "users",
    lookupDisplayField: "fullName",
    searchField: "fullName",
    // Admin UI for accounts; authentication is gated by `active` in lib/auth.js and lib/session.js.
    fields: [
      { name: "fullName", type: "text", label: "Full Name", showInView: true },
      { name: "email", type: "email", label: "Email", showInView: true },
      { name: "password", type: "password", label: "Password", showInView: true },
      { name: "role", type: "number", label: "Role", showInView: true },
      {
        // Required link to Unit Master: which branch/team this login belongs to.
        name: "unit",
        type: "lookup",
        label: "Unit",
        required: true,
        showInView: true,
        lookup: { module: "unit_master", valueField: "id" }
      },
      {
        // Yes/No: whether this account may log in.
        name: "active",
        type: "select",
        label: "Active",
        showInView: true,
        options: [
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" }
        ],
        // Default values are used for the create form only.
        default: "Yes"
      },
      ...STANDARD_ROW_AUDIT_FIELDS
    ]
  },

  // ---------------------------------------------------------------------------
  // USER PERMISSIONS — Per-user access to each module (the “keys” to each door)
  // ---------------------------------------------------------------------------
  // One row links one user to one module and stores flags: can they view, create,
  // edit, delete? The Permissions Matrix UI edits this; keys must match module
  // names here (e.g. employee_master). Row scopes (own/unit/all) live in the DB too.
  // RBAC join table: columns match lib/rbac.js (user_id, module, can_*) + standard row audit columns.
  // Dashboard uses the matrix UI (all modules as rows); `module` must match these config keys.
  user_permissions: {
    label: "User Permissions",
    icon: "🔐",
    group: "Administration",
    table: "user_permissions",
    fields: [
      {
        // Which user this permission row belongs to (picked from Users).
        name: "user_id",
        type: "lookup",
        label: "User",
        required: true,
        showInView: true,
        lookup: { module: "users", valueField: "id", labelField: "fullName" }
      },
      // Which module these rights apply to (text key matching `modules` keys).
      { name: "module", type: "text", label: "Module", showInView: true },
      { name: "can_view", type: "number", label: "Can View (1/0)", showInView: true },
      { name: "can_create", type: "number", label: "Can Create (1/0)", showInView: true },
      { name: "can_edit", type: "number", label: "Can Edit (1/0)", showInView: true },
      { name: "can_delete", type: "number", label: "Can Delete (1/0)", showInView: true },
      ...STANDARD_ROW_AUDIT_FIELDS
    ]
  },

  // ---------------------------------------------------------------------------
  // AUDIT LOGS — Read-only history of changes (who changed what)
  // ---------------------------------------------------------------------------
  // Filled automatically by the app when records are created/updated/deleted.
  // readOnly = you cannot add fake history through the normal CRUD API.
  audit_logs: {
    label: "Audit Logs",
    icon: "🧾",
    group: "Administration",
    table: "audit_logs",
    readOnly: true,
    // Append-only via lib/audit.js; generic POST/PUT blocked when `readOnly` is set.
    fields: [
      { name: "user_id", type: "number", label: "User ID", showInView: true },
      { name: "module", type: "text", label: "Module", showInView: true },
      { name: "action", type: "text", label: "Action", showInView: true },
      { name: "record_id", type: "number", label: "Record ID", showInView: true },
      ...STANDARD_ROW_AUDIT_FIELDS
    ]
  },

  // ---------------------------------------------------------------------------
  // COMPANY MASTER — Companies (organizations) you do business with or employ under
  // ---------------------------------------------------------------------------
  company_master: {
    label: "Company Master",
    icon: "🏢",
    group: "HR",
    table: "company_master",
    lookupDisplayField: "name",
    fields: [
      { name: "name", type: "text", label: "Name", required: true, showInView: true },
      // Longer text area on form (rows hint for UI); required address.
      { name: "address", type: "text", rows: "3" ,label: "Address", required: true, showInView: true },
      {
        name: "active",
        type: "select",
        label: "Active",
        showInView: true,
        options: [
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" }
        ],
        default: "Yes"
      },
      ...STANDARD_ROW_AUDIT_FIELDS
    ]
  },

  // ---------------------------------------------------------------------------
  // EMPLOYEE MASTER — Staff records (HR)
  // ---------------------------------------------------------------------------
  // Core HR data: name, email, unit, salary, IDs, optional join/exit dates, gov IDs,
  // and active flag. Sensitive fields are flagged for possible future masking in UI.
  employee_master: {
    label: "Employee Master",
    icon: "🧑‍💼",
    group: "HR",
    table: "employee_master",
    lookupDisplayField: "name",
    fields: [
      { name: "name", type: "text", label: "Name", required: true, showInView: true },
      { name: "email", type: "email", label: "Email", required: true, showInView: true },
      {
        name: "unit",
        type: "lookup",
        label: "Unit",
        required: true,
        showInView: true,
        lookup: { module: "unit_master", valueField: "id" }
      },
      { name: "grossSalary", type: "number", label: "Gross Salary", required: true, showInView: false },
      { name: "employeeID", type: "text", label: "Employee ID", required: true, showInView: true },
      { name: "designation", type: "text", label: "Designation", required: true, showInView: true },
      { name: "doj", type: "date", label: "Date of Joining", showInView: false },
      { name: "dor", type: "date", label: "Date of Resignation", showInView: false },
      { name: "aadharNo", type: "text", label: "Aadhar Number", sensitive: true, showInView: false },
      { name: "panNo", type: "text", label: "PAN Number", sensitive: true, showInView: false },
      { name: "esiNo", type: "text", label: "ESI Number", sensitive: true, showInView: false },
      { name: "pfNo", type: "text", label: "EPF Number", sensitive: true, showInView: false },
      // `sensitive` is informational for now (UI masking could be added later).
      {
        name: "active",
        type: "select",
        label: "Active",
        showInView: true,
        options: [
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" }
        ],
        default: "Yes"
      },
      ...STANDARD_ROW_AUDIT_FIELDS
    ]
  },

  /**
   * Table `unit_master`: id (PK), unitCode, unitName, personIncharge (FK → employee_master.id),
   * caseTarget, recoveryTarget, active, + row audit columns.
   */
  // ---------------------------------------------------------------------------
  // UNIT MASTER — Branches / units (teams) and optional numeric targets
  // ---------------------------------------------------------------------------
  unit_master: {
    label: "Unit Master",
    icon: "👥",
    group: "HR",
    table: "unit_master",
    lookupDisplayField: "unitName",
    fields: [
      { name: "unitCode", type: "text", label: "Unit code", required: true, showInView: true },
      { name: "unitName", type: "text", label: "Unit name", required: true, showInView: true },
      { name: "personIncharge", type: "text", label: "Person in charge", required: true, showInView: true },
      { name: "caseTarget", type: "number", label: "Case target", showInView: true },
      { name: "recoveryTarget", type: "number", label: "Recovery target", showInView: true },
      {
        name: "active",
        type: "select",
        label: "Active",
        showInView: true,
        options: [
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" }
        ],
        default: "Yes"
      },
      ...STANDARD_ROW_AUDIT_FIELDS
    ]
  },

  // ---------------------------------------------------------------------------
  // FINANCIAL YEAR MASTER — Accounting periods (start/end, flags)
  // ---------------------------------------------------------------------------
  financial_year_master: {
    label: "Financial Year Master",
    icon: "🏢",
    group: "Accounts",
    table: "financial_year_master",
    lookupDisplayField: "yearCode",
    fields: [
      { name: "yearCode", type: "text", label: "Year Code", required: true, showInView: true },
      { name: "startDate", type: "date", label: "Start Date", required: true, showInView: true },
      { name: "endDate", type: "date", label: "End Date", required: true, showInView: true },
      {
        name: "active",
        type: "select",
        label: "Active",
        showInView: false,
        options: [
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" }
        ],
        default: "Yes"
      },
      {
        // Often used to stop posting when year is closed.
        name: "freezeTransactions",
        type: "select",
        label: "Freeze Transactions",
        showInView: false,
        options: [
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" }
        ],
        default: "No"
      },
      ...STANDARD_ROW_AUDIT_FIELDS
    ]
  },

  // ---------------------------------------------------------------------------
  // PARTY MASTER — Accounting CUSTOMER / PARTIES
  // ---------------------------------------------------------------------------
  financial_year_master: {
    label: "Party Master",
    icon: "🤝",
    group: "Accounts",
    table: "party_master",
    lookupDisplayField: "partyName",
    fields: [
      { name: "partyName", type: "text", label: "Party Name", required: true, showInView: true },
      { name: "address", type: "text", rows: 3, label: "Address", required: false, showInView: false },
      {
        name: "active",
        type: "select",
        label: "Active",
        showInView: true,
        options: [
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" }
        ],
        default: "Yes"
      },
      ...STANDARD_ROW_AUDIT_FIELDS
    ]
  },

  // ---------------------------------------------------------------------------
  // BANK MASTER
  // ---------------------------------------------------------------------------
  bank_master: {
    label: "Bank Master",
    icon: "🏢",
    group: "Banks",
    table: "bank_master",
    lookupDisplayField: "bankName",
    fields: [
      { name: "bankCode", type: "text", label: "Short Code", required: true, showInView: true },
      { name: "bankName", type: "text", label: "Name", required: true, showInView: true },
      { name: "logoPath", type: "text", label: "Logo Path", required: false, showInView: false },
      { name: "caseNoPrefix", type: "text", label: "Case No Prefix", required: true, showInView: false },
      {
        name: "active",
        type: "select",
        label: "Active",
        showInView: true,
        options: [
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" }
        ],
        default: "Yes"
      },
      ...STANDARD_ROW_AUDIT_FIELDS
    ]
  },

  // ---------------------------------------------------------------------------
  // CURRENT ACCOUNT MASTER — company bank accounts
  // ---------------------------------------------------------------------------
  current_account_master: {
    label: "Current Account Master",
    icon: "💳",
    group: "Accounts",
    table: "current_account_master",
    lookupDisplayField: "branch",
    fields: [
      {
        name: "unit",
        type: "lookup",
        label: "Unit",
        required: true,
        showInView: true,
        lookup: { module: "unit_master", valueField: "id" }
      },
      {
        name: "bank",
        type: "lookup",
        label: "Bank",
        required: true,
        showInView: true,
        lookup: { module: "bank_master", valueField: "id" }
      },
      { name: "branch", type: "text", label: "Branch", required: true, showInView: true },
      { name: "accountName", type: "text", label: "Account Name", required: true, showInView: true },
      { name: "accountNo", type: "text", label: "Account No", required: false, showInView: true },
      { name: "ifscCode", type: "text", label: "IFSC Code", required: true, showInView: true },
      { name: "panNo", type: "text", label: "PAN No", required: true, showInView: false },
      { name: "gstNo", type: "text", label: "GST No", required: true, showInView: false },
      {
        name: "active",
        type: "select",
        label: "Active",
        showInView: true,
        options: [
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" }
        ],
        default: "Yes"
      },
      ...STANDARD_ROW_AUDIT_FIELDS
    ]
  },

  // ---------------------------------------------------------------------------
  // HEAD OFFICE / ZONAL OFFICE MASTER
  // ---------------------------------------------------------------------------
  ho_zo_master: {
    label: "HO / ZO Master",
    icon: "🏬",
    group: "Banks",
    table: "ho_zo_master",
    lookupDisplayField: "shortCode",
    fields: [
      {
        name: "bank",
        type: "lookup",
        label: "Bank",
        required: true,
        showInView: true,
        lookup: { module: "bank_master", valueField: "id" }
      },
      { name: "shortCode", type: "text", label: "Short Code", required: true, showInView: true },
      { name: "fullName", type: "text", label: "Full Name", required: true, showInView: true },
      { name: "place", type: "text", label: "Place", required: true, showInView: true },
      {
        name: "active",
        type: "select",
        label: "Active",
        showInView: true,
        options: [
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" }
        ],
        default: "Yes"
      },
      ...STANDARD_ROW_AUDIT_FIELDS
    ]
  },

  // ---------------------------------------------------------------------------
  // REGIONAL OFFICE MASTER
  // ---------------------------------------------------------------------------
  rbo_master: {
    label: "RBO / RO Master",
    icon: "🏣",
    group: "Banks",
    table: "rbo_master",
    lookupDisplayField: "shortCode",
    fields: [
      {
        name: "ho_zo",
        type: "lookup",
        label: "HO/ZO",
        required: true,
        showInView: true,
        lookup: { module: "ho_zo_master", valueField: "id" }
      },
      { name: "shortCode", type: "text", label: "Short Code", required: true, showInView: true },
      { name: "fullName", type: "text", label: "Full Name", required: true, showInView: true },
      { name: "place", type: "text", label: "Place", required: true, showInView: true },
      {
        name: "active",
        type: "select",
        label: "Active",
        showInView: true,
        options: [
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" }
        ],
        default: "Yes"
      },
      ...STANDARD_ROW_AUDIT_FIELDS
    ]
  },

  // ---------------------------------------------------------------------------
  // BRANCH MASTER
  // ---------------------------------------------------------------------------
  branch_master: {
    label: "Branch Master",
    icon: "🏦",
    group: "Banks",
    table: "branch_master",
    lookupDisplayField: "branchName",
    fields: [
      {
        name: "rbo_ro",
        type: "lookup",
        label: "RBO/RO",
        required: true,
        showInView: true,
        lookup: { module: "rbo_master", valueField: "id",  ui: "popup", pickerLimit: 25, pickerSortBy: "fullName",
          pickerColumns: [
            { field: "ho_zoLabel", header: "HO / ZO" },
            { field: "shortCode", header: "Short Code" },
            { field: "fullName", header: "Full Name" },
            { field: "place", header: "Place" }
          ]
        }
      },
      { name: "branchCode", type: "text", label: "Branch Code", required: true, showInView: true },
      { name: "branchName", type: "text", label: "Branch Name", required: true, showInView: true },
      { name: "place", type: "text", label: "Place", required: true, showInView: true },
      {
        name: "active",
        type: "select",
        label: "Active",
        showInView: true,
        options: [
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" }
        ],
        default: "Yes"
      },
      ...STANDARD_ROW_AUDIT_FIELDS
    ]
  }
};
