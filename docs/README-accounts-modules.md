# Accounts screens — simple guide (Loan Account & Suspense Entry)

This note is for anyone using or supporting the ERP, not only developers. It explains **what these screens do**, **how voucher numbers work**, and **what users should expect**.

---

## Loan Account (`accounts_loan_ac`)

### What is this screen for?

Use **Loan Account** to record money **received from** or **paid toward** loan-related activity. You pick the **unit**, **date**, **transaction type** (money in = **Receipt**, money out = **Payment**), **party**, how it was paid (**payment mode**), and the **amount**, with remarks and optional cheque details when needed.

### Voucher number (automatic reference)

When you save a **new** row, the system assigns a **Voucher No.** You do not type it on first save; it appears after save and in the confirmation popup.

- **Receipt** transactions get numbers like: `LN/CR/<financial year code>/0001`, `0002`, …  
- **Payment** transactions get numbers like: `LN/DR/<financial year code>/0001`, `0002`, …  

The **financial year code** comes from the **date** you entered (the system looks up which financial year that date falls in).

Receipts and payments each have their **own running counter** per year (so a Receipt and a Payment can both be “number 1” in the same year — they use different prefixes: **CR** vs **DR**).

### Checks applied when saving

Before the record is written, the server checks things like: transaction type and payment mode are valid; **cash** vs **bank/UPI/card** rules around the **NPA Current AC** field; cheque number and date when payment mode is cheque; and (for certain user roles) that the **unit** and current account choices match the user’s permissions. If something is wrong, you get a clear error instead of a half-saved record.

### After you save

If configured, a small **“saved”** message can show the new **Voucher No.** so you can note it or continue with another entry.

### One UI detail (operators with a fixed unit)

For some users, the data entry form **fills unit and NPA current account** automatically. The form is wired so that switching **payment mode to Cash** only clears the **NPA Current AC** field as intended — it should **not** wipe the rest of the form (party, amount, etc.).

---

## Suspense Entry (`accounts_suspense_entry`)

### What is this screen for?

Use **Suspense Entry** for bookkeeping entries that need to go through a **suspense** account path. You enter **date**, **transaction type** (Debit/Credit as per your configuration), **NPA Current AC**, **remarks**, and **amount**. Field-level rules follow `config/modules.js` (required flags, etc.).

### Voucher number (automatic reference)

On first save, the system assigns:

`SUSP/<financial year code>/0001`, `0002`, … (four digits)

Again, the **year code** comes from the **date** via the financial year master table. There are **no extra custom server validations** in the suspense module beyond normal required fields — the main “special” behaviour is **stamping the voucher** in the same database transaction as the insert.

### After you save

The **post-save acknowledgement** uses the same pattern as other account screens: the UI reads `postCreateAck` from module config and shows the new **Voucher No.** when the API returns it.

---

## Where the code lives (for developers)

| Area | Location |
|------|-----------|
| Loan Account — server rules & voucher stamp | `lib/modules/accountsLoanAc.js` |
| Loan Account — browser helpers (unit/NPA behaviour) | `lib/modules/accountsLoanAcClient.js` |
| Suspense Entry — voucher stamp only | `lib/modules/accountsSuspenseEntry.js` |
| Runs voucher stamping after INSERT | `lib/moduleAfterCreate.js` |
| Screen layout & fields | `config/modules.js` |

---

## Database expectations

- Tables **`accounts_loan_ac`** and **`accounts_suspense_entry`** must exist with columns declared in `config/modules.js` (including **`date`**, **`voucherNo`** where applicable).
- Running voucher numbers use the shared **`module_number_sequence`** table, one row per **module + prefix** (e.g. per financial year prefix).

---

## Tests

Automated tests for voucher stamping and core validation helpers live under `tests/jest/` (see `accountsLoanAc.test.js`, `accountsSuspenseEntry.test.js`).
