// Configuration file for project/runtime behavior.
// Keep module-specific business logic in lib/modules/<module> files.
// Read-only reports are defined in config/reports.js (not in this file).

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
 * - **lookupDisplayField**: One column, or several real columns separated by ` - ` (space-hyphen-space),
 *   e.g. `branchCode - branchName`. The app builds the shown label with CONCAT / join — no extra DB column.
 * - **lookupSearchFields** (optional): real column names; list `?search=` and lookup popup search use OR + LIKE
 *   on each. If omitted, search uses the same columns parsed from `lookupDisplayField`. Names must exist on `fields`.
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
 * `users`: login identity (id PK, username, fullName, optional email, password, role, unit, active) plus the same four
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
 * **Unit:** match logged-in `users.unit` to the **`users.unit`** of the account in **`createdBy`** (default).
 * Optional **`rowScopeUnitField`** on a module (e.g. `new_case_inward`): unit scope compares that row FK to `users.unit` instead.
 *
 * Lookup fields (`type: "lookup"`):
 * - `lookup.module`, `valueField`, optional `labelField` (else referenced module’s `lookupDisplayField`).
 * - On each referenced module set **`lookupDisplayField`**: one column or `col1 - col2` for LoV/picker label,
 *   enrich, and (if `lookupSearchFields` omitted) search/FK filter columns. Optional **`lookupSearchFields`**:
 *   explicit OR-search columns. Optional **`lookup.searchField`** on the field overrides FK filter columns only.
 * - Optional **`displayKey`** on the field: JSON key for the enriched label on list rows; if omitted, defaults to
 *   `{fieldName}Label` (e.g. `unit` → `unitLabel`). Audit fields may keep custom keys like `createdBy_fullName`.
 * - **`lookup_value_master` only:** optional `lookup.filterLookupTypeName` (exact type name in Lookup Type Master,
 *   compared case-insensitively with trim) or `lookup.filterLookupType` (numeric id of the type) limits LoV/picker
 *   rows to that type when `lov=1` requests run.
 *
 * How to choose LoV vs popup (per field):
 * - List of values (dropdown `<select>`, up to 500 rows): omit `lookup.ui`, or set
 *   `lookup.ui` to `"lov"` | `"dropdown"` | `"select"` | `"list"`.
 * - Popup picker (search + table + double-click): `lookup.ui` =
 *   `"picker"` | `"popup"` | `"modal"` | `"dialog"`.
 * - Optional: `lookup.pickerLimit` (default 20, max 100), `lookup.pickerSortBy` (server sort column; default first display column),
 *   `lookup.pickerSortDir` — `"asc"` (default) or `"desc"`.
 *   `lookup.pickerSearchPlaceholder` — optional override for popup search input hint (default derived from referenced module search columns).
 * - Popup columns: `lookup.pickerColumns`: `[{ field: "name", header: "Name" }, { field: "email", header: "Email" }]`.
 *   `field` must match a column returned by the referenced module’s list API. If omitted, one column or all parsed display columns are shown.
 *
 * **postCreateAck** (optional, per module):
 * After a successful **create**, if the server fills a running number / reference on that column, you can
 * show a blocking acknowledgement modal so users can copy it before returning to the grid. Omit on simple
 * masters that have no auto-generated key.
 * - `field` — database column name (camelCase) on the parent row; must match what your after-create logic sets.
 * - `title` — modal heading (e.g. “Case number assigned”).
 * - `hint` — short line under the title (optional; sensible default in the UI).
 * - `showPrintPdf` — if `true`, show a print button (handler is module-specific in MasterModuleClient); if `false`, hide it.
 * - `showCopyButton` — if `false`, hide Copy for the assigned reference (e.g. Public Notice: only Continue + print).
 * - `printButtonLabel` — optional label for the print button.
 *
 * =============================================================================
 * MODULE-BY-MODULE VALIDATIONS (plain English summary)
 * =============================================================================
 * Every module gets **two layers** of checks:
 * 1. **Config rules** — `required`, `maxToday`, `readOnly`, child `maxRows`, etc. in this file.
 *    The generic CRUD engine applies these on every save (see lib/services/crud.service.js).
 * 2. **Custom server rules** — only for modules listed below, in `lib/modules/<name>.js`,
 *    wired through `lib/modules/crudModuleAdapters.js`. Users cannot bypass these from the browser.
 *
 * **Financial year “freeze”** (many modules): if the transaction date falls in a year where
 * Financial Year Master has `freezeTransactions = Yes`, **role 2** (unit operator) cannot save.
 * **Role 1** (admin) is not blocked. See `lib/modules/freezeTransactionsLock.js`.
 * New Case Inward uses a similar idea on `caseStatusUpdatedDate` but blocks all non-admin users.
 *
 * | Module key | Custom logic file | Main extra rules (beyond config `required`) |
 * |------------|-------------------|---------------------------------------------|
 * | users | — | Login: active=Yes only (lib/auth.js). Row scope on `users` table is special. |
 * | user_permissions | userPermissions.js | User must exist and be active. |
 * | audit_logs | — | Read-only; no manual create/edit via CRUD. |
 * | company_master, employee_master, unit_master, financial_year_master, party_master, bank_master, current_account_master, ho_zo_master, branch_master, lookup_* , case_return_reasons, sarfaesi_case_particulars, new_case_inward_transaction_control | — | Config `required` / types only. |
 * | current_account_opening_balance | currentAccountOpeningBalance.js | FY freeze (role 2) on effectiveDate. |
 * | new_case_inward | newCaseInward.js | Case No auto-gen; loan account rules; duplicate loan ac; final-stage edit lock; case status + recovered amount rules; transaction-control backdates; FY freeze on case status date (non-admin). Child: recovered lines. |
 * | transfer_case | transferCase.js | Date = today; case/from/to/assignee rules; updates case owner; ref TRF/…; FY freeze (role 2). |
 * | public_notice | publicNotice.js | Date not future; FY freeze (role 2); case required; child max 3 rows; ref PN/… |
 * | sarfaesi_case_status_update | sarfaesiCaseStatusUpdate.js | Date not future; FY freeze (role 2); SARFAESI case only; one update per case; child particulars (readonly UI) + optional remarks; ref SRFUP/… |
 * | return_case | returnCase.js + returnCaseClient.js + returnCasePdf.js | Date not future; FY freeze (role 2); case “Returned”; checked child rows; 3-page letter PDF. |
 * | accounts_assets_investments | accountsAssetsInvestments.js | FY freeze (role 2); payment mode / cheque / unit scope; voucher no. |
 * | accounts_cash_deposit_withdraw | accountsCashDepositWithdraw.js | FY freeze (role 2); deposit/withdraw + NPA account + cheque rules; unit scope; voucher no. |
 * | accounts_current_ac_transfer | accountsCurrentAcTransfer.js | FY freeze (role 2); from ≠ to account; voucher no. |
 * | accounts_expense_voucher | accountsExpenseVoucher.js | FY freeze (role 2); payment mode / cheque / unit; voucher no. |
 * | accounts_loan_ac | accountsLoanAc.js | FY freeze (role 2); receipt/payment + cheque + unit; voucher LN/CR or LN/DR. |
 * | accounts_suspense_entry | accountsSuspenseEntry.js | FY freeze (role 2); suspense voucher SUSP/… |
 * | recovery_invoice | recoveryInvoice.js | FY freeze (role 2); invoice no.; final-invoice flag on case; client submit checks. |
 * | sarfaesi_invoice | sarfaesiInvoice.js | FY freeze (role 2); SARFAESI case picker; invoice no.; cancellation rules. |
 * | vehicle_invoice | vehicleInvoice.js | FY freeze (role 2); vehicle case rules; invoice no.; cancellation rules. |
 *   | rbo_master | rboMaster.js | When RBO active flag changes, can sync linked branches. |
 * | task_master | task.js | Assignee must be active user; status history server-written; comments append-only. |
 *
 * Full narrative for operators and developers: README.md § “Module-by-module validations”.
 * =============================================================================
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
  { name: "createdDate", type: "text", label: "Created Date", excludeFromForm: true, showInView: false },
  {
    name: "modifiedBy",
    type: "lookup",
    label: "Modified by",
    excludeFromForm: true,
    showInView: true,
    lookup: { module: "users", valueField: "id", labelField: "fullName" },
    displayKey: "modifiedBy_fullName"
  },
  { name: "modifiedDate", type: "text", label: "Modified Date", excludeFromForm: true, showInView: false }
];

/** All new_case_inward Case No popup pickers: newest record first. */
const NCI_CASE_NO_PICKER_SORT = { pickerSortBy: "id", pickerSortDir: "desc" };

// All screens/modules the ERP knows about. Key = internal name; value = settings + fields.
// Each module value typically has: label, icon, group, table, fields[], and optional flags (readOnly, postCreateAck, …).
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
    icon: "👤",
    group: "Administration",
    table: "users",
    lookupDisplayField: "fullName",
    searchField: "fullName",
    lookupSearchFields: ["fullName", "username", "email"],
    // Admin UI for accounts; authentication is gated by `active` in lib/auth.js and lib/session.js.
    fields: [
      { name: "username", type: "text", label: "Username", required: true, showInView: true },
      { name: "fullName", type: "text", label: "Full Name", showInView: true },
      { name: "email", type: "email", label: "Email", required: false, showInView: true },
      { name: "password", type: "password", label: "Password", showInView: true },
      { name: "role", type: "number", label: "Role", showInView: true },
      {
        // Required link to Unit Master: which branch/team this login belongs to.
        name: "unit",
        type: "lookup",
        label: "Unit",
        required: true,
        showInView: true,
        lookup: { module: "unit_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
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
  // user_id LoV and saves: only users with active = "Yes" (lib/modules/userPermissions.js + matrix route).
  user_permissions: {
    label: "User Permissions",
    icon: "🗝️",
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
        // LoV lists only Active = Yes (GET …/users?lov=1&f_active=Yes — see crud list filters).
        lookup: {
          module: "users",
          valueField: "id",
          labelField: "fullName",
          extraLovParams: { f_active: "Yes" }
        }
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
      {
        // Show friendly user full name instead of numeric id in grid.
        name: "user_id",
        type: "lookup",
        label: "User",
        showInView: true,
        lookup: { module: "users", valueField: "id", labelField: "fullName" }
      },
      { name: "module", type: "text", label: "Module", showInView: true },
      { name: "action", type: "text", label: "Action", showInView: true },
      { name: "record_label", type: "text", label: "Record", showInView: true },
      { name: "record_id", type: "number", label: "Record ID", showInView: true },
      // DB timestamp when audit entry was inserted.
      { name: "created_at", type: "text", label: "Created At", showInView: true },
      // Raw JSON snapshot before change (create => null).
      { name: "old_data", type: "text", label: "Old Data", showInView: true },
      // Raw JSON snapshot after change (delete => null).
      { name: "new_data", type: "text", label: "New Data", showInView: true }
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
    icon: "🗓️",
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
        showInView: true,
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
  // CURRENT ACCOUNT OPENING BALANCE
  // ---------------------------------------------------------------------------
  current_account_opening_balance: {
    label: "Current AC OP Balance",
    icon: "🏢",
    group: "Accounts",
    table: "current_account_opening_balance",
    lookupDisplayField: "currentAccount",
    fields: [
      { name: "effectiveDate", type: "date", label: "Effective Date", required: true, showInView: true },
      {
        name: "currentAccount",
        type: "lookup",
        label: "Current Account",
        required: true,
        showInView: true,
        lookup: { module: "current_account_master", valueField: "id" }
      },
      { name: "amount", type: "number", label: "Amount", required: true, showInView: true },
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
      ...STANDARD_ROW_AUDIT_FIELDS
    ]
  },

  // ---------------------------------------------------------------------------
  // PARTY MASTER — Accounting CUSTOMER / PARTIES
  // ---------------------------------------------------------------------------
  party_master: {
    label: "Party Master",
    icon: "🧑‍💼",
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
      { name: "loanAccountNoLength", type: "number", label: "Loan AC No Length", required: true, showInView: false },
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
        lookup: { module: "bank_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
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
        lookup: { module: "ho_zo_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
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
    lookupDisplayField: "branchCode - branchName",
    lookupSearchFields: ["branchCode", "branchName"],
    fields: [
      {
        name: "rbo_ro",
        type: "lookup",
        label: "RBO/RO",
        required: true,
        showInView: true,
        lookup: { module: "rbo_master", valueField: "id",  ui: "popup", pickerLimit: 25, pickerSortBy: "shortCode", extraLovParams: { f_active: "Yes" },
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
  },

  // ---------------------------------------------------------------------------
  // LOOKUP TYPE MASTER
  // ---------------------------------------------------------------------------
  lookup_type_master: {
    label: "Lookup Type Master",
    icon: "📂",
    group: "Lookups",
    table: "lookup_type_master",
    lookupDisplayField: "lookupType",
    fields: [
      { name: "lookupType", type: "text", label: "Lookup Type", required: true, showInView: true },
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
  // LOOKUP VALUES MASTER
  // ---------------------------------------------------------------------------
  lookup_value_master: {
    label: "Lookup Value Master",
    icon: "🗃️",
    group: "Lookups",
    table: "lookup_value_master",
    lookupDisplayField: "lookupValue",
    fields: [
      {
        name: "lookupType",
        type: "lookup",
        label: "Lookup Type",
        required: true,
        showInView: true,
        lookup: { module: "lookup_type_master", valueField: "id",  ui: "popup", pickerLimit: 25, pickerSortBy: "lookupType",
          pickerColumns: [
            { field: "lookupType", header: "Lookup Type" }
          ]
        }
      },
      { name: "lookupValue", type: "text", label: "Lookup Value", required: true, showInView: true },
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
  // NEW CASE INWARD TRANSACTION CONTROL — Backdate lock/unlock for NCI save/update
  // ---------------------------------------------------------------------------
  // Business control table for NCI validations:
  // - Field Name = Entrustment Date / Amount Recovered
  // - Allow Flag = Yes (unrestricted) / No (restrict by Days)
  // - Days = allowed backdated range when Allow Flag = No
  new_case_inward_transaction_control: {
    label: "NCI Transaction Control",
    icon: "🔓",
    group: "Administration",
    table: "new_case_inward_transaction_control",
    lookupDisplayField: "field_name",
    fields: [
      {
        name: "field_name",
        type: "select",
        label: "Field",
        required: true,
        showInView: true,
        options: [
          { label: "Entrustment Date", value: "Entrustment Date" },
          { label: "Amount Recovered", value: "Amount Recovered" },
          { label: "Case Status Update", value: "Case Status Update" }
        ]
      },
      {
        name: "allow_flag",
        type: "select",
        label: "Allow",
        required: true,
        showInView: true,
        options: [
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" }
        ],
        default: "Yes"
      },
      {
        name: "days",
        type: "number",
        label: "Days",
        required: true,
        showInView: true
      },
      { name: "is_active", type: "number", label: "Active (1/0)", showInView: false },
      { name: "remarks", type: "text", label: "Remarks", showInView: false },
      ...STANDARD_ROW_AUDIT_FIELDS
    ]
  },

  case_return_reasons: {
    label: "Case Return Reasons",
    icon: "📜",
    group: "Cases",
    table: "case_return_reasons",
    lookupDisplayField: "returnReason",
    fields: [
      { name: "returnReason", type: "text", rows:4, label: "Return Reason", required: true, showInView: true },
      { name: "sequence", type: "number", label: "Sequence", showInView: true },
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

  // Master list of checklist lines used by SARFAESI Case Status Update (sequence + active flag).
  // Validations: config only (particulars text required). No custom lib/modules file.
  sarfaesi_case_particulars: {
    label: "SARFAESI Case Particulars",
    icon: "📑",
    group: "Cases",
    table: "sarfaesi_case_particulars",
    lookupDisplayField: "particulars",
    fields: [
      { name: "particulars", type: "text", rows:2 , label: "Particulars", required: true, showInView: true },
      { name: "sequence", type: "number", label: "Sequence", showInView: true },
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
  // NEW CASE INWARD — Parent transaction; line items in `new_case_inward_amount_recovered`
  // Case No is filled by the server after save: {bank caseNoPrefix}/{loan category code}/{nnnnn}.
  // Case No / sequences: lib/modules/newCaseInward.js (LOAN_CATEGORY_CASE_NO_CODES by lookup label + assignNewCaseInwardCaseNo)
  // ---------------------------------------------------------------------------
  new_case_inward: {
    label: "New Case Inward",
    icon: "📥",
    group: "Cases",
    table: "new_case_inward",
    lookupDisplayField: "caseNo",
    searchField: "caseNo",
    rowScopeUnitField: "unit",
    postCreateAck: {
      field: "caseNo",
      title: "Case Number Assigned",
      hint: "Note this number for your reference before continuing.",
      showPrintPdf: true
    },
    fields: [
      {
        name: "caseNo",
        type: "text",
        label: "Case No",
        required: false,
        showInView: true,
        excludeFromForm: true,
        displayOnEdit: true,
        // Filled automatically on first save; shown when editing so users see their reference number.
      },
      {
        name: "unit",
        type: "lookup",
        label: "Unit",
        required: true,
        showInView: true,
        lookup: { module: "unit_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "entrustmentDate",
        type: "date",
        label: "Entrustment Date",
        required: true,
        showInView: true,
        maxToday: true
      },
      {
        name: "receivedFrom",
        type: "lookup",
        label: "Received From",
        required: true,
        showInView: false,
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          labelField: "lookupValue",
          filterLookupTypeName: "Case Received From",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "fileMaintenance",
        type: "lookup",
        label: "File Maintenance",
        required: true,
        showInView: false,
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          labelField: "lookupValue",
          filterLookupTypeName: "File Maintenance",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "branch",
        type: "lookup",
        label: "Branch",
        required: true,
        showInView: true,
        lookup: {
          module: "branch_master",
          valueField: "id",
          ui: "picker",
          pickerLimit: 25,
          pickerSortBy: "branchName",
          extraLovParams: { f_active: "Yes" },
          pickerColumns: [
            { field: "rbo_roLabel", header: "RBO / RO" },
            { field: "branchCode", header: "Branch Code" },
            { field: "branchName", header: "Branch Name" },
            { field: "place", header: "Place" }
          ]
        }
      },
      { name: "borrower", type: "text", label: "Borrower", required: true, showInView: true },
      { name: "loanAccountNo", type: "text", label: "Loan Account No", required: true, showInView: true },
      {
        name: "loanCategory",
        type: "lookup",
        label: "Loan Category",
        required: true,
        showInView: false,
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          labelField: "lookupValue",
          filterLookupTypeName: "Loan Category",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "loanType",
        type: "lookup",
        label: "Loan Type",
        required: true,
        showInView: true,
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          labelField: "lookupValue",
          filterLookupTypeName: "Loan Type",
          extraLovParams: { f_active: "Yes" }
        }
      },
      { name: "npaDate", type: "date", label: "NPA Date", required: false, showInView: false, maxToday: true },
      {
        name: "npaStatus",
        type: "lookup",
        label: "NPA Status",
        required: true,
        showInView: false,
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          labelField: "lookupValue",
          filterLookupTypeName: "NPA Status",
          extraLovParams: { f_active: "Yes" }
        }
      },
      { name: "closureBalance", type: "number", label: "Closure Balance", required: true, showInView: false,
        // DB: BIGINT; validate range in module-specific logic if needed.
      },
      {
        name: "caseStatusUpdatedDate",
        type: "date",
        label: "Date",
        required: false,
        showInView: false,
        maxToday: true
      },
      {
        name: "caseStatus",
        type: "lookup",
        label: "Case Status",
        required: false,
        showInView: false,
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          labelField: "lookupValue",
          filterLookupTypeName: "Case Status",
          extraLovParams: { f_active: "Yes" }
        }
      },
      { name: "caseStatusRemarks", type: "text", rows:4, label: "Case Status Remarks", required: false, showInView: false },
      {
        name: "finalInvoice",
        type: "select",
        label: "Final Invoice",
        required: false,
        showInView: false,
        excludeFromForm: true,
        options: [
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" }
        ],
        default: "No"
      },
      ...STANDARD_ROW_AUDIT_FIELDS
    ],
    /**
     * Child grid: shown on the entry form below parent fields (MasterModuleClient).
     * `key` — stable id for React state and the save payload (`childTableRows[key]`); not the SQL table name.
     * `table` — actual DB table for your custom save / triggers.
     * Table width = sum of columns: `<colgroup>` uses `indexColumnWidth`, each field’s `columnWidth`
     * (or type defaults: date 11rem, number 9rem, else 10rem), then `actionsColumnWidth` or ~11.25rem for four icon buttons in one row.
     */
    childTables: [
      {
        key: "amount_recovered",
        table: "new_case_inward_amount_recovered",
        parentFkField: "caseInwardId", // FK column on child table → new_case_inward.id
        label: "Amount Recovered",
        indexColumnWidth: "4rem",
        fields: [
          {
            name: "recoveredDate",
            type: "date",
            label: "Recovered Date",
            placeholder: "Date",
            required: true,
            maxToday: true,
            columnWidth: "15rem"
          },
          {
            name: "recoveredAmount",
            type: "number",
            label: "Recovered Amount",
            placeholder: "Amount",
            required: true,
            columnWidth: "15rem"
          }
          // add more line fields, lookups, etc.
        ]
      }
    ]
  },

  // -----------------------------------------------------------------------------
  // Transfer Case: move a case to another unit/user. Server: lib/modules/transferCase.js.
  // Validations: date must be today; case/from/to/assignee; from = current owner; to ≠ from;
  //   assignee in to-unit; FY freeze (role 2); ref TRF/<FY>/<serial>. Saves update new_case_inward owner.
  // UI: transferCaseClient.js (fromUnit read-only, toUnit/assignee filters).
  // -----------------------------------------------------------------------------
  transfer_case: {
    label: "Transfer Case",
    icon: "🔄",
    group: "Cases",
    table: "transfer_case",
    lookupDisplayField: "refNo",
    fields: [
      {
        name: "refNo",
        type: "text",
        label: "Ref No",
        required: false,
        showInView: true,
        excludeFromForm: true,
        displayOnEdit: true,
        // Filled automatically on first save; shown when editing so users see their reference number.
      },
      {
        name: "date",
        type: "date",
        label: "Date",
        required: true,
        showInView: true,
        maxToday: true
      },
      {
        name: "caseNo",
        type: "lookup",
        label: "Case No",
        required: true,
        showInView: true,
        lookup: {
          module: "new_case_inward",
          valueField: "id",
          ui: "picker",
          extraLovParams: { transfer_case_case_picker: "1" },
          pickerLimit: 25,
          ...NCI_CASE_NO_PICKER_SORT,
          pickerColumns: [
            { field: "caseNo", header: "Case No" },
            { field: "unitLabel", header: "Unit" },
            { field: "branchLabel", header: "Branch" },
            { field: "borrower", header: "Borrower" },
            { field: "loanCategoryLabel", header: "Loan Category" },
            { field: "loanTypeLabel", header: "Loan Type" },
            { field: "caseStatusLabel", header: "Case Status" },
          ]
        }
      },
      {
        name: "fromUnit",
        type: "lookup",
        label: "From Unit",
        required: true,
        showInView: true,
        lookup: { module: "unit_master", valueField: "id" }
      },
      {
        name: "toUnit",
        type: "lookup",
        label: "To Unit",
        required: true,
        showInView: true,
        lookup: { module: "unit_master", valueField: "id" }
      },
      {
        name: "assignee",
        type: "lookup",
        label: "Assignee",
        required: true,
        showInView: true,
        lookup: { module: "users", valueField: "id", labelField: "fullName" }
      },
      { name: "remarks", type: "text", rows:2, label: "Remarks", required: false, showInView: false },
      ...STANDARD_ROW_AUDIT_FIELDS
    ]
  },

  // -----------------------------------------------------------------------------
  // Public Notice: notice for a case. Server: lib/modules/publicNotice.js.
  // Validations: date not future; FY freeze (role 2); case required; child max 3 rows with type + display name.
  // Ref PN/<FY>/<serial>; PDF via publicNoticePdf.js. UI: publicNoticeClient.js (case snapshot).
  // -----------------------------------------------------------------------------
  public_notice: {
    label: "Public Notice",
    icon: "📢",
    group: "Cases",
    table: "public_notice",
    lookupDisplayField: "refNo",
    postCreateAck: {
      field: "refNo",
      title: "Public Notice saved",
      hint: "Your reference number is shown below. Continue to go back to the list, or print the notice.",
      showPrintPdf: true,
      showCopyButton: false,
      printButtonLabel: "Print Public Notice"
    },
    fields: [
      {
        name: "refNo",
        type: "text",
        label: "Ref No",
        required: false,
        showInView: true,
        excludeFromForm: true,
        displayOnEdit: true,
        // Server fills this after save: PN/<yearCode>/<running serial>.
      },
      {
        name: "date",
        type: "date",
        label: "Date",
        required: true,
        showInView: true,
        maxToday: true
      },
      {
        name: "caseNo",
        type: "lookup",
        label: "Case No",
        required: true,
        showInView: true,
        lookup: {
          module: "new_case_inward",
          valueField: "id",
          ui: "picker",
          extraLovParams: { public_notice_case_picker: "1" },
          pickerLimit: 25,
          ...NCI_CASE_NO_PICKER_SORT,
          pickerColumns: [
            { field: "caseNo", header: "Case No" },
            { field: "unitLabel", header: "Unit" },
            { field: "branchLabel", header: "Branch" },
            { field: "borrower", header: "Borrower" },
            { field: "loanCategoryLabel", header: "Loan Category" }
          ]
        }
      },
      ...STANDARD_ROW_AUDIT_FIELDS
    ],
    childTables: [
      {
        key: "public_notice_details",
        table: "public_notice_details",
        parentFkField: "publicNoticeId",
        label: "Details",
        indexColumnWidth: "4rem",
        maxRows: 3,
        fields: [
          {
            name: "displayName",
            type: "text",
            label: "Display Name",
            required: true,
            columnWidth: "18rem"
          },
          {
            name: "type",
            type: "lookup",
            label: "Type",
            required: true,
            lookup: {
              module: "lookup_value_master",
              valueField: "id",
              labelField: "lookupValue",
              filterLookupTypeName: "PN Person Type"
            },
            columnWidth: "14rem"
          },
          {
            name: "address",
            type: "text",
            rows: 4,
            label: "Address",
            required: false,
            columnWidth: "24rem"
          }
        ]
      }
    ]
  },

  // -----------------------------------------------------------------------------
  // SARFAESI Case Status Update — one SARFAESI case, checklist of particulars + remarks.
  // Server: lib/modules/sarfaesiCaseStatusUpdate.js (ref SRFUP/<FY>/<####>, dup case, FY freeze).
  // Client: lib/modules/sarfaesiCaseStatusUpdateClient.js (case picker, preload particulars, snapshot).
  // Validations (server): date required, not future; role-2 FY freeze; case = SARFAESI loan category;
  //   each case only once on this module; ≥1 child row; particulars required per row; remarks optional;
  //   particulars must be active rows in sarfaesi_case_particulars. UI: particulars read-only on child grid.
  // -----------------------------------------------------------------------------
  sarfaesi_case_status_update: {
    label: "SARFAESI Case Update",
    icon: "📄",
    group: "Cases",
    table: "sarfaesi_case_status_update",
    lookupDisplayField: "refNo",
    postCreateAck: {
      field: "refNo",
      title: "SARFAESI Case Status Saved",
      hint: "Your reference number is shown below.",
      showPrintPdf: false,
      showCopyButton: false,
    },
    fields: [
      {
        name: "refNo",
        type: "text",
        label: "Ref No",
        required: false,
        showInView: true,
        excludeFromForm: true,
        displayOnEdit: true,
        // Server fills after save: SRFUP/<yearCode>/<4-digit serial> (sarfaesiCaseStatusUpdate.js).
      },
      {
        name: "date",
        type: "date",
        label: "Date",
        required: true,
        showInView: true,
        // maxToday in UI; server also blocks future dates and frozen FY (role 2).
        maxToday: true
      },
      {
        name: "caseNo",
        type: "lookup",
        label: "Case No",
        required: true,
        showInView: true,
        lookup: {
          module: "new_case_inward",
          valueField: "id",
          ui: "picker",
          // Client overrides picker to sarfaesi_case_status_update_case_picker (SARFAESI + unused cases).
          extraLovParams: { public_notice_case_picker: "1" },
          pickerLimit: 25,
          ...NCI_CASE_NO_PICKER_SORT,
          pickerColumns: [
            { field: "caseNo", header: "Case No" },
            { field: "unitLabel", header: "Unit" },
            { field: "branchLabel", header: "Branch" },
            { field: "borrower", header: "Borrower" },
            { field: "loanCategoryLabel", header: "Loan Category" }
          ]
        }
      },
      ...STANDARD_ROW_AUDIT_FIELDS
    ],
    childTables: [
      {
        key: "sarfaesi_case_status_update_details",
        table: "sarfaesi_case_status_update_details",
        parentFkField: "sarfaesiUpdateId",
        label: "Details",
        indexColumnWidth: "4rem",
        fields: [
          {
            name: "particulars",
            type: "lookup",
            label: "Particulars",
            required: true,
            readOnly: true, // Pre-filled on new entry; user cannot change the particular line.
            lookup: {
              module: "sarfaesi_case_particulars",
              valueField: "id",
              labelField: "particulars"
            },
            columnWidth: "30rem"
          },
          {
            name: "remarks",
            type: "text",
            rows: 1,
            label: "Remarks",
            required: false, // Optional in UI and on server.
            columnWidth: "24rem"
          }
        ]
      }
    ]
  },

  // -----------------------------------------------------------------------------
  // Return Case — formal letter when an NPA case is returned to the bank.
  //
  // Flow: user picks a case in “Returned” status, ticks return reasons, saves.
  // After save they can Print → 3-page PDF (RETURN_<refNo>.pdf).
  //
  // Server rules: lib/modules/returnCase.js
  // Browser (preload reasons, Print download): lib/modules/returnCaseClient.js
  // PDF layout: lib/modules/returnCasePdf.js — docs/return-case-pdf.md
  // -----------------------------------------------------------------------------
  return_case: {
    label: "Return Case",
    icon: "↩️",
    group: "Cases",
    table: "return_case",
    lookupDisplayField: "refNo",
    postCreateAck: {
      field: "refNo",
      title: "Return Case saved",
      hint: "Your reference number is shown below. Continue to go back to the list.",
      showPrintPdf: true,
      printButtonLabel: "Print",
      showCopyButton: true
    },
    fields: [
      {
        name: "refNo",
        type: "text",
        label: "Ref No",
        required: false,
        showInView: true,
        excludeFromForm: true,
        displayOnEdit: true
      },
      {
        name: "date",
        type: "date",
        label: "Date",
        required: true,
        showInView: true,
        maxToday: true
      },
      {
        name: "caseNo",
        type: "lookup",
        label: "Case No",
        required: true,
        showInView: true,
        lookup: {
          module: "new_case_inward",
          valueField: "id",
          ui: "picker",
          extraLovParams: { return_case_case_picker: "1" },
          pickerLimit: 25,
          ...NCI_CASE_NO_PICKER_SORT,
          pickerColumns: [
            { field: "caseNo", header: "Case No" },
            { field: "unitLabel", header: "Unit" },
            { field: "branchLabel", header: "Branch" },
            { field: "borrower", header: "Borrower" },
            { field: "loanCategoryLabel", header: "Loan Category" }
          ]
        }
      },
      {
        name: "investigatingOfficer",
        type: "lookup",
        label: "Investigating Officer",
        required: true,
        showInView: false,
        lookup: {
          module: "employee_master",
          valueField: "id",
          ui: "lov",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "borrowerLatestDetails",
        type: "text",
        rows: 4,
        label: "Borrower Latest Details",
        required: false,
        showInView: false
      },
      {
        name: "ccTo",
        type: "text",
        rows: 4,
        label: "CC To",
        required: false,
        showInView: false
      },
      ...STANDARD_ROW_AUDIT_FIELDS
    ],
    childTables: [
      {
        key: "return_case_details",
        table: "return_case_details",
        parentFkField: "returnCaseId",
        label: "Return Case Details",
        indexColumnWidth: "4rem",
        fields: [
          {
            name: "select",
            type: "checkbox",
            label: "Select",
            required: false,
            columnWidth: "5rem"
          },
          {
            name: "returnReason",
            type: "text",
            label: "Return Reason",
            required: false,
            requiredWhenChecked: { checkboxField: "select" },
            rows: 4,
            columnWidth: "40rem"
          }
        ]
      }
    ]
  },

  // =============================================================================
  // ACCOUNTS — voucher-style screens (voucherNo / reference filled on server after first save)
  // Each block below points to `lib/modules/<module>.js` for stamp + rules and, where present,
  // `lib/modules/<module>Client.js` for browser-only behaviour. Generic wiring: moduleAfterCreate.js,
  // crudModuleAdapters.js (when beforeWrite exists), MasterModuleClient.js, crud.service.js.
  // =============================================================================
  // Assets & Investments (`accounts_assets_investments`)
  // - Voucher: ASS/<financial year code>/#### (assignAccountsAssetsInvestmentsVoucherNo).
  // - Same family of rules as expense voucher: payment mode, NPA current AC, cheques, role 2 — assetsInvestments.js + assetsInvestmentsClient.js.
  // =============================================================================
  accounts_assets_investments: 
  {
    label: "Assets & Investments",
    icon: "🚗",
    group: "Accounts",
    table: "accounts_assets_investments",
    lookupDisplayField: "voucherNo",
    postCreateAck: {
      field: "voucherNo",
      title: "Assets & Investments saved",
      hint: "Your voucher number is shown below. Continue to return to the list.",
      showPrintPdf: false,
      showCopyButton: false
    },
    fields: [
      { name: "voucherNo", type: "text", label: "Voucher No", required: false, showInView: true, excludeFromForm: true, displayOnEdit: true,
        // Filled automatically on first save; shown when editing so users see their reference number.
      },
      {
        name: "unit", type: "lookup", label: "Unit", required: true, showInView: true,
        lookup: { module: "unit_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      { name: "date", type: "date", label: "Date", required: true, showInView: true, maxToday: true },
      {
        name: "paidTo",
        type: "lookup",
        label: "Paid To",
        required: true,
        showInView: true,
        lookup: { module: "party_master", valueField: "id",  ui: "popup", pickerLimit: 25, pickerSortBy: "partyName", extraLovParams: { f_active: "Yes" },
          pickerColumns: [
            { field: "partyName", header: "Party Name" },
            { field: "address", header: "Address" },
          ]
        }
      },
      { name: "remarks", type: "text", label: "Remarks", required: true, showInView: true },
      {
        name: "paymentMode",
        type: "select",
        label: "Payment Mode",
        showInView: true,
        required: true,
        options: [
          { label: "Card", value: "Card" },
          { label: "Cheque", value: "Cheque" },
          { label: "Cash", value: "Cash" },
          { label: "UPI", value: "UPI" }
        ]
      },
      {
        name: "npaCurrentAc",
        type: "lookup",
        label: "NPA Current AC",
        required: false,
        showInView: true,
        lookup: { module: "current_account_master", valueField: "id" }
      },
      { name: "chequeNo", type: "text", label: "Cheque No", required: false, showInView: false },
      { name: "chequeDate", type: "date", label: "Cheque Date", required: false, showInView: false, maxToday: true },
      { name: "inFavourOf", type: "text", label: "In Favour Of", required: true, showInView: false },
      { name: "amount", type: "number", label: "Amount", required: true, showInView: true },
      ...STANDARD_ROW_AUDIT_FIELDS
    ]
  },

  // Cash Deposit & Withdraw (`accounts_cash_deposit_withdraw`)
  // - Voucher: Deposit → C/DP/<FY>/#### ; Withdraw → C/WD/<FY>/#### (per transaction type + FY).
  // - Server rules + stamp: accountsCashDepositWithdraw.js + client accountsCashDepositWithdrawClient.js (same UX patterns as other cash/NPA screens).
  // =============================================================================
  accounts_cash_deposit_withdraw: 
  {
    label: "Cash Deposit & Withdraw",
    icon: "💰",
    group: "Accounts",
    table: "accounts_cash_deposit_withdraw",
    lookupDisplayField: "voucherNo",
    postCreateAck: {
      field: "voucherNo",
      title: "Cash Deposit & Withdraw saved",
      hint: "Your voucher number is shown below. Continue to enter another record.",
      showPrintPdf: false,
      showCopyButton: false
    },
    fields: [
      { name: "voucherNo", type: "text", label: "Voucher No", required: false, showInView: true, excludeFromForm: true, displayOnEdit: true,
        // Filled automatically on first save; shown when editing so users see their reference number.
      },
      {
        name: "unit", type: "lookup", label: "Unit", required: true, showInView: true,
        lookup: { module: "unit_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      { name: "date", type: "date", label: "Date", required: true, showInView: true, maxToday: true },
      {
        name: "transactionType",
        type: "select",
        label: "Transaction Type",
        showInView: true,
        required: true,
        options: [
          { label: "Withdraw", value: "Withdraw" },
          { label: "Deposit", value: "Deposit" }
        ]
      },
      {
        name: "paymentMode",
        type: "select",
        label: "Payment Mode",
        showInView: true,
        required: true,
        options: [
          { label: "Card", value: "Card" },
          { label: "Cheque", value: "Cheque" },
          { label: "Cash", value: "Cash" },
          { label: "UPI", value: "UPI" }
        ]
      },
      { name: "remarks", type: "text", label: "Remarks", required: true, showInView: true },

      {
        name: "npaCurrentAc",
        type: "lookup",
        label: "NPA Current AC",
        required: true,
        showInView: true,
        lookup: { module: "current_account_master", valueField: "id" }
      },
      { name: "chequeNo", type: "text", label: "Cheque No", required: false, showInView: false },
      { name: "chequeDate", type: "date", label: "Cheque Date", required: false, showInView: false, maxToday: true },
      { name: "inFavourOf", type: "text", label: "In Favour Of", required: true, showInView: false },
      { name: "amount", type: "number", label: "Amount", required: true, showInView: true },
      ...STANDARD_ROW_AUDIT_FIELDS
    ]
  },

  // Current AC Transfer (`accounts_current_ac_transfer`)
  // - Voucher: ACC/TRF/<FY>/#### — lib/modules/accountsCurrentAcTransfer.js (no separate *Client.js).
  // - beforeWrite checks from/to accounts (see adapter); stamp runs in moduleAfterCreate.
  // =============================================================================
  accounts_current_ac_transfer: 
  {
    label: "Current AC Transfer",
    icon: "➡️",
    group: "Accounts",
    table: "accounts_current_ac_transfer",
    lookupDisplayField: "voucherNo",
    postCreateAck: {
      field: "voucherNo",
      title: "Current AC Transfer saved",
      hint: "Your voucher number is shown below. Continue to enter another record.",
      showPrintPdf: false,
      showCopyButton: false
    },
    fields: [
      { name: "voucherNo", type: "text", label: "Voucher No", required: false, showInView: true, excludeFromForm: true, displayOnEdit: true,
        // Filled automatically on first save; shown when editing so users see their reference number.
      },
      { name: "date", type: "date", label: "Date", required: true, showInView: true, maxToday: true },
      {
        name: "fromCurrentAc",
        type: "lookup",
        label: "From Current AC",
        required: true,
        showInView: true,
        lookup: { module: "current_account_master", valueField: "id" }
      },
      {
        name: "toCurrentAc",
        type: "lookup",
        label: "To Current AC",
        required: true,
        showInView: true,
        lookup: { module: "current_account_master", valueField: "id" }
      },
      { name: "remarks", type: "text", label: "Remarks", required: true, showInView: true },
      { name: "amount", type: "number", label: "Amount", required: true, showInView: true },
      ...STANDARD_ROW_AUDIT_FIELDS
    ]
  },

  // Expense Voucher (`accounts_expense_voucher`)
  // - Voucher: EXP/<FY>/#### — lib/modules/accountsExpenseVoucher.js; client helper accountsExpenseVoucherClient.js (unit/NPA/payment mode UX).
  // - Template for several other account screens (validation style, postCreateAck, MasterModuleClient dynamic form key).
  // =============================================================================
  accounts_expense_voucher: 
  {
    label: "Expense Voucher",
    icon: "💸",
    group: "Accounts",
    table: "accounts_expense_voucher",
    lookupDisplayField: "voucherNo",
    postCreateAck: {
      field: "voucherNo",
      title: "Expense Voucher saved",
      hint: "Your voucher number is shown below. Continue to enter another record.",
      showPrintPdf: false,
      showCopyButton: false
    },
    fields: [
      { name: "voucherNo", type: "text", label: "Voucher No", required: false, showInView: true, excludeFromForm: true, displayOnEdit: true,
        // Filled automatically on first save; shown when editing so users see their reference number.
      },
      {
        name: "unit", type: "lookup", label: "Unit", required: true, showInView: true,
        lookup: { module: "unit_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      { name: "date", type: "date", label: "Date", required: true, showInView: true, maxToday: true },
      {
        name: "paidTo",
        type: "lookup",
        label: "Paid To",
        required: true,
        showInView: true,
        lookup: { module: "party_master", valueField: "id",  ui: "popup", pickerLimit: 25, pickerSortBy: "partyName", extraLovParams: { f_active: "Yes" },
          pickerColumns: [
            { field: "partyName", header: "Party Name" },
            { field: "address", header: "Address" },
          ]
        }
      },
      {
        name: "expenseCategory", type: "lookup", label: "Expense Category", required: true, showInView: true,
        lookup: { module: "lookup_value_master", valueField: "id", filterLookupTypeName: "Payment Category", extraLovParams: { f_active: "Yes" } }
      },
      { name: "remarks", type: "text", label: "Remarks", required: true, showInView: true },
      {
        name: "paymentMode",
        type: "select",
        label: "Payment Mode",
        showInView: true,
        required: true,
        options: [
          { label: "Card", value: "Card" },
          { label: "Cheque", value: "Cheque" },
          { label: "Cash", value: "Cash" },
          { label: "UPI", value: "UPI" }
        ]
      },
      {
        name: "npaCurrentAc",
        type: "lookup",
        label: "NPA Current AC",
        required: false,
        showInView: true,
        lookup: { module: "current_account_master", valueField: "id" }
      },
      { name: "chequeNo", type: "text", label: "Cheque No", required: false, showInView: false },
      { name: "chequeDate", type: "date", label: "Cheque Date", required: false, showInView: false, maxToday: true },
      { name: "inFavourOf", type: "text", label: "In Favour Of", required: true, showInView: false },
      { name: "amount", type: "number", label: "Amount", required: true, showInView: true },
      ...STANDARD_ROW_AUDIT_FIELDS
    ]
  },

  // =============================================================================
  // Loan Account (`accounts_loan_ac`)
  // - Records loan-related receipts and payments (see transactionType: Receipt | Payment).
  // - Voucher number is NOT typed on first save: after INSERT the server stamps voucherNo in the
  //   same transaction — Receipt uses LN/CR/<financial year code>/####, Payment uses LN/DR/…/####
  //   (lib/modules/accountsLoanAc.js). postCreateAck below drives the save confirmation modal.
  // - Extra save rules (payment mode, NPA current account, cheques, role-2 unit scope) live in
  //   accountsLoanAc.js and are wired via lib/modules/crudModuleAdapters.js — not in this file.
  // - Browser helpers (e.g. operator unit / NPA behaviour) are in accountsLoanAcClient.js.
  // Layman doc: docs/README-accounts-modules.md
  // =============================================================================
  accounts_loan_ac: 
  {
    label: "Loan Account",
    icon: "📉",
    group: "Accounts",
    table: "accounts_loan_ac",
    lookupDisplayField: "voucherNo",
    postCreateAck: {
      field: "voucherNo",
      title: "Loan entry saved",
      hint: "Your voucher number is shown below. Continue to enter another record.",
      showPrintPdf: false,
      showCopyButton: false
    },
    fields: [
      { name: "voucherNo", type: "text", label: "Voucher No", required: false, showInView: true, excludeFromForm: true, displayOnEdit: true,
        // Filled automatically on first save; shown when editing so users see their reference number.
      },
      {
        name: "unit", type: "lookup", label: "Unit", required: true, showInView: true,
        lookup: { module: "unit_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      { name: "date", type: "date", label: "Date", required: true, showInView: true, maxToday: true },
      {
        name: "transactionType",
        type: "select",
        label: "Transaction Type",
        showInView: true,
        required: true,
        options: [
          { label: "Receipt", value: "Receipt" },
          { label: "Payment", value: "Payment" }
        ]
      },
      {
        name: "party",
        type: "lookup",
        label: "Party",
        required: true,
        showInView: true,
        lookup: { module: "party_master", valueField: "id",  ui: "popup", pickerLimit: 25, pickerSortBy: "partyName", extraLovParams: { f_active: "Yes" },
          pickerColumns: [
            { field: "partyName", header: "Party Name" },
            { field: "address", header: "Address" },
          ]
        }
      },
      { name: "remarks", type: "text", label: "Remarks", required: true, showInView: true },
      {
        name: "paymentMode",
        type: "select",
        label: "Payment Mode",
        showInView: true,
        required: true,
        options: [
          { label: "Card", value: "Card" },
          { label: "Cheque", value: "Cheque" },
          { label: "Cash", value: "Cash" },
          { label: "UPI", value: "UPI" }
        ]
      },
      {
        name: "npaCurrentAc",
        type: "lookup",
        label: "NPA Current AC",
        required: false,
        showInView: true,
        lookup: { module: "current_account_master", valueField: "id" }
      },
      { name: "chequeNo", type: "text", label: "Cheque No", required: false, showInView: false },
      { name: "chequeDate", type: "date", label: "Cheque Date", required: false, showInView: false, maxToday: true },
      { name: "inFavourOf", type: "text", label: "In Favour Of", required: true, showInView: false },
      { name: "amount", type: "number", label: "Amount", required: true, showInView: true },
      ...STANDARD_ROW_AUDIT_FIELDS
    ]
  },

  // =============================================================================
  // Suspense Entry (`accounts_suspense_entry`)
  // - Simple suspense postings (Debit/Credit, amount, linked NPA current account as configured).
  // - Voucher number is filled only after first save: SUSP/<financial year code>/#### via
  //   lib/modules/accountsSuspenseEntry.js in the same DB transaction as INSERT (moduleAfterCreate).
  // - No extra CRUD-phase module adapter: only generic required-field validation from this blueprint;
  //   postCreateAck shows the new voucher in the acknowledgement modal (same mechanism as other
  //   voucher screens — MasterModuleClient + API postCreateAck in crud.service.js).
  // Layman doc: docs/README-accounts-modules.md
  // =============================================================================
  accounts_suspense_entry: 
  {
    label: "Suspense Entry",
    icon: "❓",
    group: "Accounts",
    table: "accounts_suspense_entry",
    lookupDisplayField: "voucherNo",
    postCreateAck: {
      field: "voucherNo",
      title: "Suspense entry saved",
      hint: "Your voucher number is shown below. Continue to enter another record.",
      showPrintPdf: false,
      showCopyButton: false
    },
    fields: [
      { name: "voucherNo", type: "text", label: "Voucher No", required: false, showInView: true, excludeFromForm: true, displayOnEdit: true,
        // Filled automatically on first save; shown when editing so users see their reference number.
      },
      { name: "date", type: "date", label: "Date", required: true, showInView: true, maxToday: true },
      {
        name: "transactionType",
        type: "select",
        label: "Transaction Type",
        showInView: true,
        required: true,
        options: [
          { label: "Debit", value: "Debit" },
          { label: "Credit", value: "Credit" }
        ]
      },
      {
        name: "npaCurrentAc",
        type: "lookup",
        label: "NPA Current AC",
        required: true,
        showInView: true,
        lookup: { module: "current_account_master", valueField: "id" }
      },
      { name: "remarks", type: "text", label: "Remarks", required: true, showInView: true },
      { name: "amount", type: "number", label: "Amount", required: true, showInView: true },
      ...STANDARD_ROW_AUDIT_FIELDS
    ]
  },

  // Invoice modules: 3-page PDF print when postCreateAck.showPrintPdf is true.
  // PDF code in lib/modules/*InvoicePdf.js; guides in docs/invoices-pdf.md and docs/*-invoice-pdf.md.
  recovery_invoice: {
    label: "Recovery Invoice",
    icon: "📈",
    group: "Invoice",
    table: "recovery_invoice",
    lookupDisplayField: "invoiceNo",
    searchField: "invoiceNo",
    postCreateAck: {
      field: "invoiceNo",
      title: "Recovery Invoice Generated",
      hint: "Note this number for your reference before continuing.",
      showPrintPdf: true,
      printButtonLabel: "Print"
    },
    fields: [
      {
        name: "invoiceNo",
        type: "text",
        label: "Invoice No",
        required: false,
        showInView: true,
        excludeFromForm: true,
        displayOnEdit: true,
        // Filled automatically on first save; shown when editing so users see their reference number.
      },
      { name: "date", type: "date", label: "Date", required: true, showInView: true, maxToday: true },
      {
        name: "caseNo",
        type: "lookup",
        label: "Case No",
        required: true,
        showInView: true,
        lookup: {
          module: "new_case_inward",
          valueField: "id",
          ui: "picker",
          pickerLimit: 25,
          ...NCI_CASE_NO_PICKER_SORT,
          pickerColumns: [
            { field: "caseNo", header: "Case No" },
            { field: "unitLabel", header: "Unit" },
            { field: "branchLabel", header: "Branch" },
            { field: "borrower", header: "Borrower" },
            { field: "loanCategoryLabel", header: "Loan Category" },
            { field: "loanTypeLabel", header: "Loan Type" },
            { field: "caseStatusLabel", header: "Case Status" },
          ]
        }
      },
      {
        name: "npaCurrentAc",
        type: "lookup",
        label: "NPA Current AC",
        required: true,
        showInView: false,
        lookup: { module: "current_account_master", valueField: "id" }
      },
      {
        name: "cancelledInvoice",
        type: "select",
        label: "Cancelled Invoice",
        required: true,
        showInView: true,
        options: [
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" }
        ],
        default: "No"
      },
      {
        name: "finalInvoice",
        type: "select",
        label: "Final Invoice",
        required: true,
        showInView: true,
        options: [
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" }
        ],
        default: "Yes"
      },
      { name: "cancellationReason", type: "text", rows:1, label: "Cancellation Reason", required: false, showInView: false },
      { name: "grandTotal", type: "number", label: "Grand Total", required: false, showInView: true },
      ...STANDARD_ROW_AUDIT_FIELDS
    ],
    childTables: [
      {
        key: "recovery_charges",
        table: "recovery_invoice_charges",
        parentFkField: "recoveryInvoiceId", // FK column on child table
        label: "Recovery Charges",
        indexColumnWidth: "4rem",
        fields: [
          {
            name: "percentage",
            type: "number",
            label: "Percentage",
            placeholder: "Percentage",
            required: false,
            footerSum: false,
            /** Client-only: plain digits, no ₹ formatting; no decimals. */
            integerOnly: true,
            columnWidth: "15rem"
          },
          {
            name: "amount",
            type: "number",
            label: "Amount",
            placeholder: "Amount",
            required: true,
            columnWidth: "15rem"
          }
          // add more line fields, lookups, etc.
        ]
      }
    ]
  },

  sarfaesi_invoice: {
    label: "SARFAESI Invoice",
    icon: "🏠",
    group: "Invoice",
    table: "sarfaesi_invoice",
    lookupDisplayField: "invoiceNo",
    searchField: "invoiceNo",
    postCreateAck: {
      field: "invoiceNo",
      title: "SARFAESI Invoice Generated",
      hint: "Note this number for your reference before continuing.",
      showPrintPdf: true,
      printButtonLabel: "Print"
    },
    fields: [
      {
        name: "invoiceNo",
        type: "text",
        label: "Invoice No",
        required: false,
        showInView: true,
        excludeFromForm: true,
        displayOnEdit: true,
        // Filled automatically on first save; shown when editing so users see their reference number.
      },
      { name: "date", type: "date", label: "Date", required: true, showInView: true, maxToday: true },
      {
        name: "caseNo",
        type: "lookup",
        label: "Case No",
        required: true,
        showInView: true,
        lookup: {
          module: "new_case_inward",
          valueField: "id",
          ui: "picker",
          pickerLimit: 25,
          ...NCI_CASE_NO_PICKER_SORT,
          pickerColumns: [
            { field: "caseNo", header: "Case No" },
            { field: "unitLabel", header: "Unit" },
            { field: "branchLabel", header: "Branch" },
            { field: "borrower", header: "Borrower" },
            { field: "loanCategoryLabel", header: "Loan Category" },
            { field: "loanTypeLabel", header: "Loan Type" },
            { field: "caseStatusLabel", header: "Case Status" },
          ]
        }
      },
      {
        name: "npaCurrentAc",
        type: "lookup",
        label: "NPA Current AC",
        required: true,
        showInView: false,
        lookup: { module: "current_account_master", valueField: "id" }
      },
      {
        name: "cancelledInvoice",
        type: "select",
        label: "Cancelled Invoice",
        required: true,
        showInView: true,
        options: [
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" }
        ],
        default: "No"
      },
      {
        name: "finalInvoice",
        type: "select",
        label: "Final Invoice",
        required: true,
        showInView: true,
        options: [
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" }
        ],
        default: "Yes"
      },
      { name: "cancellationReason", type: "text", rows:1, label: "Cancellation Reason", required: false, showInView: false },
      { name: "grandTotal", type: "number", label: "Grand Total", required: false, showInView: true },
      ...STANDARD_ROW_AUDIT_FIELDS
    ],
    childTables: [
      {
        key: "sarfaesi_charges",
        table: "sarfaesi_invoice_charges",
        parentFkField: "sarfaesiInvoiceId", // FK column on child table
        label: "SARFAESI Charges",
        indexColumnWidth: "4rem",
        fields: [
          {
            name: "particulars", type: "lookup", label: "Particulars", required: true, columnWidth: "25rem",
            lookup: {
              module: "lookup_value_master",
              valueField: "id",
              labelField: "lookupValue",
              filterLookupTypeName: "SARFAESI Invoice Particulars",
              extraLovParams: { f_active: "Yes" }
            }
          },
          {
            name: "remarks",
            type: "text",
            label: "Remarks",
            required: true,
            rows: 1,
            columnWidth: "20rem"
          },
          {
            name: "amount",
            type: "number",
            label: "Amount",
            placeholder: "Amount",
            required: true,
            columnWidth: "10rem"
          }
          // add more line fields, lookups, etc.
        ]
      }
    ]
  },

  vehicle_invoice: {
    label: "Vehicle Invoice",
    icon: "🚕",
    group: "Invoice",
    table: "vehicle_invoice",
    lookupDisplayField: "invoiceNo",
    searchField: "invoiceNo",
    postCreateAck: {
      field: "invoiceNo",
      title: "Vehicle Invoice Generated",
      hint: "Note this number for your reference before continuing.",
      showPrintPdf: true
    },
    fields: [
      {
        name: "invoiceNo",
        type: "text",
        label: "Invoice No",
        required: false,
        showInView: true,
        excludeFromForm: true,
        displayOnEdit: true,
        // Filled automatically on first save; shown when editing so users see their reference number.
      },
      { name: "date", type: "date", label: "Date", required: true, showInView: true, maxToday: true },
      {
        name: "caseNo",
        type: "lookup",
        label: "Case No",
        required: true,
        showInView: true,
        lookup: {
          module: "new_case_inward",
          valueField: "id",
          ui: "picker",
          pickerLimit: 25,
          ...NCI_CASE_NO_PICKER_SORT,
          pickerColumns: [
            { field: "caseNo", header: "Case No" },
            { field: "unitLabel", header: "Unit" },
            { field: "branchLabel", header: "Branch" },
            { field: "borrower", header: "Borrower" },
            { field: "loanCategoryLabel", header: "Loan Category" },
            { field: "loanTypeLabel", header: "Loan Type" },
            { field: "caseStatusLabel", header: "Case Status" },
          ]
        }
      },
      {
        name: "npaCurrentAc",
        type: "lookup",
        label: "NPA Current AC",
        required: true,
        showInView: false,
        lookup: { module: "current_account_master", valueField: "id" }
      },
      {
        name: "cancelledInvoice",
        type: "select",
        label: "Cancelled Invoice",
        required: true,
        showInView: true,
        options: [
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" }
        ],
        default: "No"
      },
      {
        name: "finalInvoice",
        type: "select",
        label: "Final Invoice",
        required: true,
        showInView: true,
        options: [
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" }
        ],
        default: "Yes"
      },
      { name: "cancellationReason", type: "text", rows:1, label: "Cancellation Reason", required: false, showInView: false },
      { name: "grandTotal", type: "number", label: "Grand Total", required: false, showInView: true },
      ...STANDARD_ROW_AUDIT_FIELDS
    ],
    childTables: [
      {
        key: "vehicle_charges",
        table: "vehicle_invoice_charges",
        parentFkField: "vehicleInvoiceId", // FK column on child table
        label: "Seizing Charges",
        indexColumnWidth: "4rem",
        fields: [
          {
            name: "particulars", type: "lookup", label: "Particulars", required: true, columnWidth: "25rem",
            lookup: {
              module: "lookup_value_master",
              valueField: "id",
              labelField: "lookupValue",
              filterLookupTypeName: "Vehicle Invoice Particulars",
              extraLovParams: { f_active: "Yes" }
            }
          },
          {
            name: "remarks",
            type: "text",
            label: "Remarks",
            required: true,
            rows: 1,
            columnWidth: "20rem"
          },
          {
            name: "amount",
            type: "number",
            label: "Amount",
            placeholder: "Amount",
            required: true,
            columnWidth: "10rem"
          }
          // add more line fields, lookups, etc.
        ]
      }
    ]
  },

  invoices_received: {
    label: "Invoice Received",
    icon: "💵",
    group: "Invoice",
    table: "invoices_received",
    lookupDisplayField: "refNo",
    fields: [
      {
        name: "refNo",
        type: "text",
        label: "Ref No",
        required: false,
        showInView: true,
        excludeFromForm: true,
        displayOnEdit: true,
        // Filled automatically on first save; shown when editing so users see their reference number.
      },
      {
        name: "receivedDate",
        type: "date",
        label: "Received Date",
        required: true,
        showInView: true,
        maxToday: true
      },
      {
        name: "recoveryInvoice",
        type: "lookup",
        label: "Recovery Invoice",
        required: false,
        showInView: true,
        lookup: {
          module: "recovery_invoice",
          valueField: "id",
          ui: "picker",
          pickerLimit: 25,
          pickerSortBy: "invoiceNo",
          pickerColumns: [
            { field: "date", header: "Date" },
            { field: "invoiceNo", header: "Invoice No" },
            { field: "caseNoLabel", header: "Case No" },
            { field: "npaCurrentAcLabel", header: "NPA Current AC" },
            { field: "grandTotal", header: "Invoice Amount" },
          ]
        }
      },
      {
        name: "sarfaesiInvoice",
        type: "lookup",
        label: "SARFAESI Invoice",
        required: false,
        showInView: true,
        lookup: {
          module: "sarfaesi_invoice",
          valueField: "id",
          ui: "picker",
          pickerLimit: 25,
          pickerSortBy: "invoiceNo",
          pickerColumns: [
            { field: "date", header: "Date" },
            { field: "invoiceNo", header: "Invoice No" },
            { field: "caseNoLabel", header: "Case No" },
            { field: "npaCurrentAcLabel", header: "NPA Current AC" },
            { field: "grandTotal", header: "Invoice Amount" },
          ]
        }
      },
      {
        name: "vehicleInvoice",
        type: "lookup",
        label: "Vehicle Invoice",
        required: false,
        showInView: true,
        lookup: {
          module: "vehicle_invoice",
          valueField: "id",
          ui: "picker",
          pickerLimit: 25,
          pickerSortBy: "invoiceNo",
          pickerColumns: [
            { field: "date", header: "Date" },
            { field: "invoiceNo", header: "Invoice No" },
            { field: "caseNoLabel", header: "Case No" },
            { field: "npaCurrentAcLabel", header: "NPA Current AC" },
            { field: "grandTotal", header: "Invoice Amount" },
          ]
        }
      },
      { name: "billedAmount", type: "number", label: "Billed Amount", required: true, showInView: true },
      { name: "tdsPercentage", type: "number", label: "TDS Less %", required: false, showInView: true },
      { name: "tdsAmount", type: "number", label: "TDS Amount", required: false, showInView: true },
      { name: "receivedAmount", type: "number", label: "Received Amount", required: true, showInView: true },
      {
        name: "roundOff",
        type: "select",
        label: "Round Off",
        showInView: false,
        required: false,
        options: [
          { label: "Round Up", value: "Round Up" },
          { label: "Round Down", value: "Round Down" }
        ],
      },
      ...STANDARD_ROW_AUDIT_FIELDS
    ]
  },





  // ---------------------------------------------------------------------------
  // TASK MASTER — tasks with status history and comments (dashboard widget + admin CRUD)
  // Server: lib/modules/task.js (assignee validation, status history, append comments).
  // Dashboard UI: components/task/* via /api/task (permission dashboard_my_tasks).
  // ---------------------------------------------------------------------------
  task_master: {
    label: "Task Management",
    icon: "✅",
    group: "Tasks & Reminders",
    table: "task_master",
    lookupDisplayField: "taskTitle",
    rowScopeOwnAlsoMatchFields: ["assignee"],
    fields: [
      { name: "taskTitle", type: "text", label: "Task Title", required: true, showInView: true },
      { name: "description", type: "text", rows: 3, label: "Description", showInView: false },
      {
        name: "assignee",
        type: "lookup",
        label: "Assignee",
        required: true,
        showInView: true,
        lookup: {
          module: "users",
          valueField: "id",
          labelField: "fullName",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "followUpPerson",
        type: "lookup",
        label: "Follow-up Person",
        showInView: true,
        lookup: {
          module: "users",
          valueField: "id",
          labelField: "fullName",
          extraLovParams: { f_active: "Yes" }
        }
      },
      { name: "dueDate", type: "date", label: "Due Date", showInView: true },
      {
        name: "priority",
        type: "select",
        label: "Priority",
        showInView: true,
        options: [
          { label: "Low", value: "Low" },
          { label: "Medium", value: "Medium" },
          { label: "High", value: "High" }
        ],
        default: "Medium"
      },
      {
        name: "status",
        type: "select",
        label: "Status",
        showInView: true,
        options: [
          { label: "Pending", value: "Pending" },
          { label: "In Progress", value: "In Progress" },
          { label: "Completed", value: "Completed" },
          { label: "Cancelled", value: "Cancelled" }
        ],
        default: "Pending"
      },
      ...STANDARD_ROW_AUDIT_FIELDS
    ],
    childTables: [
      {
        key: "status_history",
        table: "task_status_history",
        parentFkField: "taskId",
        label: "Status History",
        syncMode: "serverOnly",
        fields: [
          { name: "fromStatus", type: "text", label: "From", readOnly: true, columnWidth: "10rem" },
          { name: "toStatus", type: "text", label: "To", readOnly: true, columnWidth: "10rem" },
          {
            name: "changedBy",
            type: "lookup",
            label: "Changed By",
            readOnly: true,
            lookup: { module: "users", valueField: "id", labelField: "fullName" },
            columnWidth: "12rem"
          },
          { name: "changedAt", type: "text", label: "Changed At", readOnly: true, columnWidth: "14rem" }
        ]
      },
      {
        key: "activity_log",
        table: "task_activity_log",
        parentFkField: "taskId",
        label: "Activity Log",
        syncMode: "serverOnly",
        fields: [
          { name: "fieldName", type: "text", label: "Field", readOnly: true, columnWidth: "10rem" },
          { name: "fromValue", type: "text", label: "From", readOnly: true, columnWidth: "12rem" },
          { name: "toValue", type: "text", label: "To", readOnly: true, columnWidth: "12rem" },
          {
            name: "changedBy",
            type: "lookup",
            label: "Changed By",
            readOnly: true,
            lookup: { module: "users", valueField: "id", labelField: "fullName" },
            columnWidth: "12rem"
          },
          { name: "changedAt", type: "text", label: "Changed At", readOnly: true, columnWidth: "14rem" }
        ]
      },
      {
        key: "comments",
        table: "task_comments",
        parentFkField: "taskId",
        label: "Comments",
        syncMode: "append",
        fields: [
          {
            name: "commentText",
            type: "text",
            rows: 3,
            label: "Comment",
            required: true,
            columnWidth: "28rem"
          },
          {
            name: "commentedBy",
            type: "lookup",
            label: "Commented By",
            readOnly: true,
            excludeFromForm: true,
            lookup: { module: "users", valueField: "id", labelField: "fullName" },
            columnWidth: "12rem"
          },
          {
            name: "commentedAt",
            type: "text",
            label: "Commented At",
            readOnly: true,
            excludeFromForm: true,
            columnWidth: "14rem"
          }
        ]
      }
    ]
  },

  // ---------------------------------------------------------------------------
  // REMINDER MASTER — self-reminders with activity log (dashboard widget + admin CRUD)
  // Server: lib/modules/reminder.js (ownership, recurrence spawn).
  // Dashboard UI: components/reminder/* via /api/reminder (permission dashboard_my_reminders).
  // ---------------------------------------------------------------------------
  reminder_master: {
    label: "Reminder Management",
    icon: "🔔",
    group: "Tasks & Reminders",
    table: "reminder_master",
    lookupDisplayField: "reminderTitle",
    fields: [
      { name: "reminderTitle", type: "text", label: "Reminder Title", required: true, showInView: true },
      { name: "notes", type: "text", rows: 3, label: "Notes", showInView: false },
      { name: "dueDate", type: "date", label: "Due Date", showInView: true },
      {
        name: "recurrenceType",
        type: "select",
        label: "Recurrence",
        showInView: true,
        options: [
          { label: "None", value: "None" },
          { label: "Daily", value: "Daily" },
          { label: "Weekly", value: "Weekly" },
          { label: "Monthly", value: "Monthly" },
          { label: "Yearly", value: "Yearly" }
        ],
        default: "None"
      },
      {
        name: "status",
        type: "select",
        label: "Status",
        showInView: true,
        options: [
          { label: "Pending", value: "Pending" },
          { label: "Completed", value: "Completed" },
          { label: "Cancelled", value: "Cancelled" }
        ],
        default: "Pending"
      },
      {
        name: "seriesRootId",
        type: "lookup",
        label: "Series Root",
        showInView: false,
        readOnly: true,
        excludeFromForm: true,
        lookup: { module: "reminder_master", valueField: "id", labelField: "reminderTitle" }
      },
      {
        name: "spawnedFromId",
        type: "lookup",
        label: "Spawned From",
        showInView: false,
        readOnly: true,
        excludeFromForm: true,
        lookup: { module: "reminder_master", valueField: "id", labelField: "reminderTitle" }
      },
      ...STANDARD_ROW_AUDIT_FIELDS
    ],
    childTables: [
      {
        key: "activity_log",
        table: "reminder_activity_log",
        parentFkField: "reminderId",
        label: "Activity Log",
        syncMode: "serverOnly",
        fields: [
          { name: "fieldName", type: "text", label: "Field", readOnly: true, columnWidth: "10rem" },
          { name: "fromValue", type: "text", label: "From", readOnly: true, columnWidth: "12rem" },
          { name: "toValue", type: "text", label: "To", readOnly: true, columnWidth: "12rem" },
          {
            name: "changedBy",
            type: "lookup",
            label: "Changed By",
            readOnly: true,
            lookup: { module: "users", valueField: "id", labelField: "fullName" },
            columnWidth: "12rem"
          },
          { name: "changedAt", type: "text", label: "Changed At", readOnly: true, columnWidth: "14rem" }
        ]
      }
    ]
  }

};

