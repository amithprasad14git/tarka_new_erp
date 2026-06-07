# Code comments — guide for developers

This ERP uses **layman-friendly file headers** so anyone opening a file can tell what it does without reading the whole file.

---

## What every source file should have

At the **top of the file** (after `"use client";` on React components):

1. **Category line** (optional but common) — one `//` line saying *what kind of file* this is.
2. **`/** … */` block** — 2–6 lines in plain English: purpose, who uses it, where related logic lives.

Example (`lib/modules/returnCase.js`):

```javascript
// Module-specific server rules — validations and side effects on save.

/**
 * Return Case — server-side save rules (runs before data is written to the database).
 * Case must be in “Returned” status; at least one checked return reason.
 * PDF letter: lib/modules/returnCasePdf.js — docs/return-case-pdf.md
 */
```

---

## Category lines by folder

| Folder | Typical first line |
|--------|-------------------|
| `app/api/**/route.js` | `// Application API route — …` |
| `app/**/page.js`, `layout.js` | `// Application page or layout — …` |
| `components/*.js` | `// Generic/shared file used across modules.` |
| `lib/*.js` | `// Shared library helper for reusable application logic.` |
| `lib/modules/*.js` | `// Module-specific server rules — …` |
| `lib/modules/*Client.js` | `// Module-specific browser helpers — …` |
| `lib/modules/*Pdf.js` | `// Module PDF layout — draws printable pages (pdfkit).` |
| `lib/services/*.js` | `// Shared service — database operations used by many API routes.` |
| `config/*.js` | `// Configuration — defines modules, fields, and dashboard layout.` |
| `config/reports.js` | `// Configuration — report screens (filters, columns, layout).` |
| `config/reportExportTheme.js` | `// Frozen HTML + Excel export styling for all reports.` |
| `lib/reports/*.js` | `// Shared report helper — …` or `// Report — <name>. …` |
| `lib/reports/custom/**` | `// Excel — <report name> (custom visual layout).` |
| `components/Report*.js` | `// Report UI — …` (after `"use client";`) |
| `components/reports/*.js` | `// Custom report table body — …` |
| `app/api/reports/**/route.js` | `// Application API route — run report (HTML JSON or Excel download).` |
| `tests/jest/*.test.js` | `// Test file — automated checks so changes do not break existing behaviour.` |

---

## What to write inside `/** … */`

- **What** the file does (one sentence a non-developer could understand).
- **Who calls it** (browser, API, save pipeline, Print button).
- **Where to look next** (e.g. `config/modules.js`, `docs/return-case-pdf.md`, paired `*Client.js` file).

Avoid repeating the file name only. Prefer:

- Good: “Converts rupee amounts to words for invoice PDFs.”
- Weak: “amountInWords.js — utility.”

---

## Inline comments (inside functions)

Every **non-trivial function** should have short `//` comments so a reader can scan the file without reading every line.

### Where to comment

| Location | What to write |
|----------|----------------|
| Start of exported function | One line: what it does and when it runs (e.g. “Runs before save — blocks duplicate case.”) |
| Long API `GET`/`POST` | Section markers: login check, load parent, load child rows, build PDF, return response |
| Save validators | Each rule block: date, FY freeze, child rows, ref/voucher number |
| PDF builders | Logo, headers, body, tables, sign-off, footer |
| React handlers | What the button/modal does for the user |
| `useEffect` | Why it runs (preload, idle logout, fetch on mount) |

### What to skip

- Obvious one-liners (`return null`, `i++`)
- Every `expect()` in tests — comment the **describe** / tricky mock setup instead
- Repeating the function name without adding meaning

### Example (API route)

```javascript
export async function GET(_req, { params }) {
  // Must be logged in — PDF routes never work for anonymous users.
  const user = await getRequestUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Load Return Case + checked detail rows from the database.
  const result = await getCrudRecordById(user, "return_case", id);
  ...
}
```

---

| Kind of logic | File |
|---------------|------|
| Field required on form | `config/modules.js` |
| Report filters, columns, layout | `config/reports.js` |
| Report SQL + `runReport` | `lib/reports/<report_key>.js` |
| Report pipeline (auth, Excel/HTML) | `lib/reports/report.service.js` |
| Frozen report theme (fonts, logo) | `config/reportExportTheme.js` |
| Custom report table HTML | `components/reports/<Name>.js` |
| Save validation / voucher numbers | `lib/modules/<module>.js` |
| Pickers, Print, preload child rows | `lib/modules/<module>Client.js` |
| PDF layout | `lib/modules/<module>Pdf.js` |
| Generic UI (forms, tables) | `components/` — **no** module business rules |

Report styling and pipeline rules: [docs/REPORTS.md](REPORTS.md).

See README §3A “Generic vs Module-Specific Rule”.

---

## Maintenance scripts

| Script | Purpose |
|--------|---------|
| `scripts/add-layman-file-headers.cjs` | Add missing headers (run only on new files; review diff) |
| `scripts/dedupe-layman-headers.cjs` | Remove shallow duplicate `/**` when a richer block follows |
| `scripts/strip-generic-header-lines.cjs` | Remove leftover generic one-liners |

After running these, always review `git diff` — automated headers are a starting point, not a substitute for accurate descriptions on important files.

---

## Operator-facing docs

For **Print / PDF** behaviour aimed at staff and support, use `docs/*.md` (e.g. [return-case-pdf.md](return-case-pdf.md), [invoices-pdf.md](invoices-pdf.md)) and link from README.
