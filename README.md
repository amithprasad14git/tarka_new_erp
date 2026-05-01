# Tarka New ERP

Tarka New ERP is a Next.js + MySQL ERP application built around configurable modules.  
It is designed so business teams can create, view, edit, and track records with role-based access and audit history.

---

## 1) Project At A Glance (Layman Terms)

- The app is made of many **modules** (Users, Branches, Cases, etc.).
- Each module has:
  - an entry form (add/edit),
  - a view table (saved records),
  - permissions (who can view/create/edit/delete).
- Most module behavior is controlled from one file: `config/modules.js`.
- Important business checks are enforced on the **server**, so they cannot be bypassed from UI.

---

## 2) Tech Stack

- **Frontend / Server framework:** Next.js 16
- **UI runtime:** React 18
- **Database:** MySQL (`mysql2`)
- **Auth password storage:** plain text in `users.password` (current project behavior)

Scripts (`package.json`):
- `npm run dev` - local development
- `npm run build` - production build
- `npm run start` - start production server

---

## 3) High-Level Folder Guide

- `app/` - Next.js app routes, pages, API routes
- `components/` - reusable UI components (forms, tables, topbar, lookups, etc.)
- `config/modules.js` - module registry (tables, fields, labels, lookups, visibility rules)
- `lib/` - server/business logic (RBAC, CRUD services, validations, sessions, enrichment)
- `sql/` - SQL helpers/migrations/reference scripts

---

## 3A) Generic vs Module-Specific Rule (Very Important)

Layman version:
- Generic files are "shared machines" used by every module.
- Module files are "department rules" used by one module only.
- Do not mix them.

Project rule:
- `components/` and `lib/services/` must stay generic (no module business rules hardcoded).
- Any module-specific function/validation/helper must live in:
  - `lib/modules/<module>.js` (server/domain logic)
  - `lib/modules/<module>Client.js` (client/UI behavior)
  - optional module PDF/helper file where needed.
- `lib/services/crud.service.js` should dispatch to module adapters, not contain per-module `if` branches.

Simple test before adding code:
- "Will this apply to all modules?" -> generic file.
- "Is this only for one module?" -> that module file in `lib/modules/`.

---

## 4) Authentication & Sessions

- Login validates user credentials and creates a session entry.
- Password check is plain text (`users.password` compared directly with entered password).
- This project intentionally does not use bcrypt/hashing at the moment.
- Browser stores session id in a secure cookie.
- On each request, server resolves cookie -> user.
- If session expires or user is inactive, APIs return `Unauthorized`.
- UI maps this to friendly message: **"Session expired. Please login again."**

Key files:
- `lib/auth.js`
- `lib/session.js`
- `app/api/auth/login/route.js`
- `app/api/auth/logout/route.js`

---

## 5) Permissions & Access Control

The app uses two layers:

1. **Module-level permissions** (view/create/edit/delete)  
   from `user_permissions` table.

2. **Row-level scope** (own / unit / all)  
   controls which rows user can see/edit/delete.

Admin role (`role=1`) has broad access by design.

Key files:
- `lib/rbac.js`
- `lib/rowScope.js`
- `app/api/permissions/[module]/route.js`

---

## 6) Generic CRUD Engine (Why It Scales)

Most modules run on shared CRUD handlers:

- list/create: `app/api/crud/[module]/route.js`
- get/update/delete one record: `app/api/crud/[module]/[id]/route.js`
- service logic: `lib/services/crud.service.js`

Shared features include:
- field validation by module config
- lookup label enrichment
- row-level permission checks
- audit stamp fields (`createdBy`, `createdDate`, etc.)
- optional child table syncing
- audit logs

---

## 7) Module Configuration Model (`config/modules.js`)

This file acts as ERP blueprint:

- module label/icon/group
- DB table name
- fields and types (`text`, `number`, `date`, `select`, `lookup`)
- required/readonly/display settings
- lookup relationships
- child table configuration

Because of this, many new modules can be added with little/no custom code.

---

## 8) Lookup System (Dropdowns / Picker Popups)

Lookup fields can load data from other modules:

- small lists -> dropdown (`LookupSelect`)
- large lists -> popup picker (`LookupPicker`)

Supports:
- filtered lookup types (for `lookup_value_master`)
- missing-value merge (to show previously saved FK values)
- LOV access for create-only users via referencing-module rule

Key files:
- `components/LookupSelect.js`
- `components/LookupPicker.js`
- `lib/lookupLovAccess.js`
- `lib/crudLookupEnrich.js`

---

## 9) Audit & Tracking

Every create/update/delete can be logged in `audit_logs` so teams can trace:
- who changed data,
- what changed,
- when it changed.

Key files:
- `lib/audit.js`
- `lib/crudRecordAudit.js`

---

## 10) Major Business Rules: New Case Inward

`new_case_inward` has module-specific rules in:
- `lib/modules/newCaseInward.js`

Current implemented behavior includes:

- auto-case number generation based on bank prefix + loan category
- role-2 unit auto-fill/lock on new entry
- controlled field visibility (new entry vs edit mode)
- dedicated "Case Status Update" section in edit mode (separate card):
  - `caseStatus`
  - `caseStatusUpdatedDate`
  - `caseStatusRemarks`
  - `caseStatus` is optional in edit mode
  - if `caseStatus` is selected, then `caseStatusUpdatedDate` and `caseStatusRemarks` become mandatory
- date max-today validation
- bank-wise Loan Account No length validation
- Loan Account No numeric-only validation
- duplicate Loan Account No prevention with final-stage exception rules
- special handling of `Returned` status (final but not re-entry allowed)
- role-2 edit lock for final-stage rows (view-only open still allowed)
- case-status/recovered-amount dependency checks
- case-status remarks mandatory when case status is selected
- transaction-control based backdate validation before save/update:
  - `Entrustment Date` lock/unlock via control table
  - `Amount Recovered` `recoveredDate` lock/unlock via control table
  - `Case Status Update` (`caseStatusUpdatedDate`) lock/unlock via control table
  - when locked, allowed backdate days enforced server-side for changed/new values
  - matching uses exact `field_name` values from control table:
    - `Entrustment Date`
    - `Amount Recovered`
    - `Case Status Update`
  - only active controls (`is_active = 1`) are applied in UI helper/min-date fetch
- role-based date behavior for New Case Inward:
  - non-admin edit mode: `entrustmentDate` is read-only
  - `maxToday` (future-date block) is enforced for all roles in server validation
  - backdate transaction-control checks are enforced for non-admin users
- financial-year freeze behavior:
  - checks `caseStatusUpdatedDate` against `financial_year_master` (`startDate`/`endDate`)
  - if matched year has `freezeTransactions = Yes`, save is blocked for non-admin
- edit-mode legacy-data safeguard:
  - existing child row IDs are preserved in payload so unchanged old recovered rows are not treated as new edits
- child table INR formatting, right alignment, and footer totals
- New Case Inward view-grid status dot:
  - Returned -> red dot
  - Closed / Settled under Compromise / Regularized-Upgraded / Auctioned -> green dot
  - Others / blank -> yellow dot
- post-create acknowledgement modal for generated Case No (copy support; optional print slot)
- Print Case Details button (visible in view mode for selected row, and in edit mode for saved rows)
- case details PDF download with filename: `CASE_DETAILS_<caseNo>.pdf`
- Print Branch Copy flow:
  - acknowledgement button label: `Print Branch Copy`
  - dedicated API and dedicated PDF builder (separate from Case Details PDF)
  - available in NCI view selection and edit mode action area

---

## 11) Current UX Behavior Highlights

- Large validation/error toast appears at top-center for readability.
- Error toast stays longer than success toast.
- Numbers in key forms are shown in INR-style grouping.
- Required `*` marker is shown in entry forms only (hidden in view tables).
- New Case Inward entry shows helper hints for backdate policy (based on transaction control setup).
- Child table totals show `₹` and highlighted footer band.
- Audit Logs screen is simplified for administrators:
  - no row checkbox/edit/delete controls
  - technical `record_id` hidden from view table
  - single "Compare" button per row for old/new data
  - compact JSON preview in table cells
  - compare modal shows side-by-side values with changed rows highlighted
  - date fields in compare modal are shown in readable `dd-mm-yyyy` / `dd-mm-yyyy HH:mm`
- New Case Inward case-details PDF follows a report layout (A4):
  - logo + title + case reference header
  - single-column key detail rows
  - case status/remarks table
  - amount recovered table with total
  - status mark (returned/final/in-progress) drawn as vector
  - printed date shown near report end
- Transfer Case entry behavior:
  - `date` is strictly today only (both UI and server enforce this)
  - selecting `caseNo` auto-loads current owner into `fromUnit` (read-only)
  - `toUnit` list excludes selected `fromUnit`
  - `assignee` list loads only users mapped to selected `toUnit`
  - assignee dropdown shows `No matching records` when filter returns no rows
  - picker modal width auto-expands based on number of configured columns
- Public Notice entry behavior:
  - selecting `caseNo` loads a case snapshot from `new_case_inward`
  - snapshot is shown inside an inline collapsible card (`Show` / `Hide`) below the form
  - this snapshot behavior is module-specific to `public_notice` and does not affect generic module rendering
  - after **create or update**, an acknowledgement modal shows `refNo` with **Continue** and **Print Public Notice** only (no Copy); print uses `GET /api/public-notice/pdf/:id`
  - in **view** mode, with a row selected, **Print Public Notice** appears in the toolbar; the same button appears in entry mode when editing a saved row

---

## 12) API Routes Summary

- `POST /api/auth/login` - login
- `POST /api/auth/logout` - logout
- `GET /api/permissions/:module` - module permissions for logged-in user
- `GET|POST /api/crud/:module` - list/create
- `GET|PUT|DELETE /api/crud/:module/:id` - one-record operations
- `GET|POST /api/user-permissions-matrix` - permission matrix UI backend
- `GET /api/new-case-inward/loan-account-rule?branchId=` - branch->bank loan rule resolver
- `GET /api/new-case-inward/case-details-pdf/:id` - download New Case Inward case details PDF
- `GET /api/new-case-inward/branch-copy-pdf/:id` - download New Case Inward branch copy PDF
- `GET /api/new-case-inward/transaction-control` - active transaction-control rows for NCI date-picker hints/min dates
- `POST /api/auth/change-password` - change password for logged-in user
- `GET /api/public-notice/pdf/:id` - download Public Notice PDF (session + same view rules as CRUD get); layout uses **SamsungSharpSans** fonts like other PDFs; assets in `public/images/` only: **`sbi_logo_long`**, **`canara_bank_logo`**, **`bob_logo`**, **`boi_logo`** (bank header by `bank_master.bankCode`: SBI/CAN/BOB/BOI), plus **`public_notice`** and **`public_notice_picture_box`** (`.png` or `.jpg`); missing files are skipped. Download filename: **`PUBLIC_NOTICE_<caseNo>.pdf`** (case no slashes become `_`)

Generic CRUD lookup (`GET /api/crud/:module?lov=1`) supports:
- `exclude_id=<id>` - removes one row id from LoV results (used by Transfer Case `toUnit`)
- numeric lookup filters like `f_unit=<id>` as exact FK matching (used by Transfer Case `assignee`)

---

## 13) Module-Specific Rules: Transfer Case

`transfer_case` custom server logic is in:
- `lib/modules/transferCase.js`

Implemented behavior:
- strict validation before write:
  - `date` must be today
  - `caseNo`, `fromUnit`, `toUnit`, `assignee` are required
  - selected `caseNo` must exist in `new_case_inward`
  - `fromUnit` must match current case owner unit
  - `toUnit` must differ from `fromUnit`
  - `assignee` must belong to selected `toUnit`
- on save, linked `new_case_inward` row is updated:
  - `unit = toUnit`
  - `createdBy = assignee`
  - `modifiedBy = assignee`
- auto-generated Ref No format:
  - `TRF/<yearCode>/<runningSerial>`
  - `<yearCode>` resolved from `financial_year_master` using transfer date
  - running serial maintained in `module_number_sequence` with transaction-safe locking
- audit behavior:
  - normal audit entry for `transfer_case` create/update
  - additional audit entry for linked `new_case_inward` ownership update (with old/new snapshot)

---

## 14) Environment / DB Notes

Set standard DB env vars for `lib/db.js`:
- `DB_HOST`
- `DB_USER`
- `DB_PASS`
- `DB_NAME`
- `DB_PORT` (optional if default)

Optional session behavior:
- `SESSION_IDLE_MINUTES`

Ensure MySQL tables used by configured modules exist and column names match config.

---

## 15) Recommended Future Improvements

- Add automated tests for module-specific business rules (especially `new_case_inward`)
- Move more hardcoded status policies to config for easier ops control
- Add migration/versioning discipline for schema changes
- Expand user-facing help docs by module

---

## 16) Quick Start

1. Install dependencies:
   - `npm install`
2. Configure DB env variables.
3. Run app:
   - `npm run dev`
4. Login with active user account and open dashboard modules.

---

## 17) Babel/Jest Sanity Checklist

When changing test/build config, quickly verify both app runtime and tests still work:

1. Check `babel.config.js` has environment split:
   - `test` env -> `@babel/preset-env` (Node/Jest)
   - non-test env -> `next/babel` (Next.js + JSX)
2. Run Jest once:
   - `npm test -- --runInBand`
3. Run Next dev once:
   - `npm run dev`
4. If you see JSX parse errors (`experimental syntax 'jsx'`), confirm non-test env is using `next/babel`.
5. If needed, inspect effective Babel config:
   - `npx cross-env BABEL_SHOW_CONFIG_FOR=app/layout.js npm run dev`
