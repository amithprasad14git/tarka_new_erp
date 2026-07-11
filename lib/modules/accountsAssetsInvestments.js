/**
 * =============================================================================
 * ACCOUNTS ASSETS & INVESTMENTS — Server save rules and voucher stamp
 * =============================================================================
 * Payment mode / NPA / cheque / unit-operator checks, FY freeze for role 2, and
 * ASS/&lt;yearCode&gt;/#### voucher numbering after insert. Form fields: config/modules.js.
 * =============================================================================
 */

import { modules } from "../../config/modules";
import { rowValueForField } from "../gridRowValue";
import { escapeSqlTableId, escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";
import {
  assertDateNotInFrozenFinancialYear,
  FREEZE_TRANSACTIONS_LOCKED_MESSAGE,
  shouldEnforceFreezeTransactionsForUser
} from "./freezeTransactionsLock";

/** Must match config/modules.js key and module_number_sequence.module */
export const ACCOUNTS_ASSETS_INVESTMENTS_MODULE_KEY = "accounts_assets_investments";

/** Role 2 = unit-scoped operators (same convention as transfer_case). */
export const ACCOUNTS_ASSETS_INVESTMENTS_UNIT_RESTRICT_ROLE = 2;

/**
 * Post-save acknowledgement modal (create only). Must stay aligned with
 * `accounts_assets_investments.postCreateAck` in config/modules.js.
 * Generic CRUD adds body.postCreateAck from createdRow[voucherNo]; MasterModuleClient shows PostCreateAckModal.
 */
export const ACCOUNTS_ASSETS_INVESTMENTS_POST_CREATE_ACK_CONFIG = {
  field: "voucherNo",
  title: "Assets & Investments saved",
  hint: "Your voucher number is shown below. Continue to return to the list.",
  valueLabel: "Voucher No",
  showPrintPdf: false,
  showCopyButton: false
};

function throwAccountsAssetsInvestmentsValidation(message) {
  throw Object.assign(new Error(message), { code: "ACCOUNTS_ASSETS_INVESTMENTS_VALIDATION_FAILED" });
}

async function assertAccountsAssetsInvestmentsDateNotInFrozenFy(conn, parentData, user) {
  // Unit operators cannot save when the voucher date falls in a frozen financial year.
  if (!shouldEnforceFreezeTransactionsForUser(user)) return;
  await assertDateNotInFrozenFinancialYear(conn, parentData?.date, {
    onBlocked: () => throwAccountsAssetsInvestmentsValidation(FREEZE_TRANSACTIONS_LOCKED_MESSAGE)
  });
}

function asPositiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizePaymentMode(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

const ALLOWED_ASSETS_PAYMENT_MODES = new Set(["card", "cheque", "cash", "upi"]);

/** Require a known assets payment mode (card / cheque / cash / upi). */
export function assertAccountsAssetsInvestmentsPaymentMode(parentData) {
  // Only the four allowed modes count — rejects blank or legacy dropdown values.
  const pm = normalizePaymentMode(parentData?.paymentMode);
  if (!pm) {
    throwAccountsAssetsInvestmentsValidation("Payment Mode is required.");
  }
  if (!ALLOWED_ASSETS_PAYMENT_MODES.has(pm)) {
    throwAccountsAssetsInvestmentsValidation("Payment Mode is invalid.");
  }
}

/**
 * Cash: NPA Current AC must be empty. Other modes: NPA Current AC is required.
 */
export function assertAccountsAssetsInvestmentsNpaCurrentAcRule(parentData) {
  const pm = normalizePaymentMode(parentData?.paymentMode);
  const caId = asPositiveInt(parentData?.npaCurrentAc);

  // Cash is not booked against an NPA current account; other modes must pick one.
  if (pm === "cash") {
    if (caId != null) {
      throwAccountsAssetsInvestmentsValidation(
        "NPA Current AC must be empty when Payment Mode is Cash."
      );
    }
    return;
  }

  if (!caId) {
    throwAccountsAssetsInvestmentsValidation(
      "NPA Current AC is required unless Payment Mode is Cash."
    );
  }
}

/**
 * Cheque mode: chequeNo and chequeDate required (server-side).
 */
export function assertAccountsAssetsInvestmentsChequeFields(parentData) {
  const pm = normalizePaymentMode(parentData?.paymentMode);
  if (pm !== "cheque") return;

  const chequeNo = String(parentData?.chequeNo ?? "").trim();
  if (!chequeNo) {
    throwAccountsAssetsInvestmentsValidation("Cheque No is required when Payment Mode is Cheque.");
  }
  const chequeDateYmd = toYyyyMmDdForSqlDateField(parentData?.chequeDate);
  if (!chequeDateYmd) {
    throwAccountsAssetsInvestmentsValidation("Cheque Date is required when Payment Mode is Cheque.");
  }
}

/**
 * Role 2: unit must match session unit; npaCurrentAc must belong to current_account_master for that unit.
 * Pass `user` from CRUD adapter ({ role, unit }) when wiring.
 */
export async function assertAccountsAssetsInvestmentsRole2UnitAndCurrentAc(conn, parentData, user) {
  // Admins may pick any unit; unit operators are locked to their branch and its current accounts.
  const role = Number(user?.role);
  if (!Number.isFinite(role) || role !== ACCOUNTS_ASSETS_INVESTMENTS_UNIT_RESTRICT_ROLE) return;

  const sessionUnitId = asPositiveInt(user?.unit);
  if (sessionUnitId == null) return;

  const rowUnitId = asPositiveInt(parentData?.unit);
  if (rowUnitId !== sessionUnitId) {
    throwAccountsAssetsInvestmentsValidation("Unit must match your assigned unit.");
  }

  const caId = asPositiveInt(parentData?.npaCurrentAc);
  if (!caId) return;

  const cam = escapeSqlTableIdForModuleConfig(modules.current_account_master);
  const [rows] = await conn.query(
    `SELECT id FROM ${cam} WHERE id = ? AND unit = ? LIMIT 1`,
    [caId, sessionUnitId]
  );
  if (!rows?.length) {
    throwAccountsAssetsInvestmentsValidation(
      "NPA Current AC must belong to your unit’s current account list."
    );
  }
}

async function resolveYearCodeByDate(conn, bizDate) {
  // Voucher prefix ASS/<yearCode>/#### must match the financial year that contains the entry date.
  const ymd = toYyyyMmDdForSqlDateField(bizDate);
  if (!ymd) {
    throwAccountsAssetsInvestmentsValidation("Date is required to generate Voucher No.");
  }
  const fyTable = escapeSqlTableIdForModuleConfig(modules.financial_year_master);
  const [rows] = await conn.query(
    `SELECT yearCode FROM ${fyTable} WHERE ? BETWEEN startDate AND endDate LIMIT 1`,
    [ymd]
  );
  const yearCode = String(rowValueForField(rows?.[0] || {}, "yearCode") ?? "").trim();
  if (!yearCode) {
    throwAccountsAssetsInvestmentsValidation("No Financial Year found for selected Date.");
  }
  return yearCode;
}

/**
 * Stamp voucherNo as ASS/&lt;yearCode&gt;/&lt;4-digit serial&gt; using module_number_sequence.
 * Call from runAfterCreateInTransaction (same pattern as public_notice / return_case).
 */
export async function assignAccountsAssetsInvestmentsVoucherNo(conn, recordId) {
  // --- Voucher number: ASS/<FY yearCode>/0001… after INSERT (create only) ---
  const mod = modules.accounts_assets_investments;
  if (!mod?.table) {
    throwAccountsAssetsInvestmentsValidation("accounts_assets_investments module config missing.");
  }
  const aaiTable = escapeSqlTableIdForModuleConfig(mod);
  const seqTable = escapeSqlTableId("module_number_sequence");

  const [rows] = await conn.query(`SELECT id, date FROM ${aaiTable} WHERE id = ? LIMIT 1`, [recordId]);
  if (!rows?.length) {
    throwAccountsAssetsInvestmentsValidation("Assets & Investments row was not found while generating Voucher No.");
  }

  const yearCode = await resolveYearCodeByDate(conn, rowValueForField(rows[0], "date"));
  const sequencePrefix = `ASS/${yearCode}`;

  // Ensure a counter row exists, then lock it so two saves cannot grab the same serial.
  await conn.query(
    `INSERT INTO ${seqTable} (module, prefix, lastNumber) VALUES (?, ?, 0)
     ON DUPLICATE KEY UPDATE lastNumber = lastNumber`,
    [ACCOUNTS_ASSETS_INVESTMENTS_MODULE_KEY, sequencePrefix]
  );

  const [seqRows] = await conn.query(`SELECT lastNumber FROM ${seqTable} WHERE module = ? AND prefix = ? FOR UPDATE`, [
    ACCOUNTS_ASSETS_INVESTMENTS_MODULE_KEY,
    sequencePrefix
  ]);
  if (!seqRows?.length) {
    throwAccountsAssetsInvestmentsValidation("Assets & Investments sequence row missing.");
  }

  const last = Number(rowValueForField(seqRows[0], "lastNumber"));
  const next = Number.isFinite(last) ? last + 1 : 1;
  const voucherNo = `ASS/${yearCode}/${String(next).padStart(4, "0")}`;

  await conn.query(`UPDATE ${seqTable} SET lastNumber = ? WHERE module = ? AND prefix = ?`, [
    next,
    ACCOUNTS_ASSETS_INVESTMENTS_MODULE_KEY,
    sequencePrefix
  ]);
  await conn.query(`UPDATE ${aaiTable} SET voucherNo = ? WHERE id = ? AND (voucherNo IS NULL OR TRIM(voucherNo) = '')`, [
    voucherNo,
    recordId
  ]);
}

/**
 * Run all Assets & Investments validations before create/update.
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {{ parentData: object, user: object }} ctx
 */
export async function validateAccountsAssetsInvestmentsBeforeWrite(conn, { parentData, user }) {
  // --- FY freeze, payment mode, NPA/cheque rules, unit-operator scope ---
  await assertAccountsAssetsInvestmentsDateNotInFrozenFy(conn, parentData, user);
  assertAccountsAssetsInvestmentsPaymentMode(parentData);
  assertAccountsAssetsInvestmentsNpaCurrentAcRule(parentData);
  assertAccountsAssetsInvestmentsChequeFields(parentData);
  await assertAccountsAssetsInvestmentsRole2UnitAndCurrentAc(conn, parentData, user);
}

/**
 * Builds effective row for rules. Cash without `npaCurrentAc` in the payload clears NPA (optional / empty).
 * On update, optional `recordId` + SQL clear runs when switching to Cash without sending npaCurrentAc (partial save).
 */
export async function applyAccountsAssetsInvestmentsBeforeWrite(conn, { oldRow, merged, user, recordId = null }) {
  // Merge draft with existing row, then clear NPA in DB when user switches to Cash without sending the field.
  const explicitNpa = merged != null && Object.prototype.hasOwnProperty.call(merged, "npaCurrentAc");
  const effectiveBase = oldRow ? { ...oldRow, ...merged } : merged;
  const pm = normalizePaymentMode(effectiveBase?.paymentMode);

  let parentData = effectiveBase;
  if (pm === "cash" && !explicitNpa) {
    parentData = { ...effectiveBase, npaCurrentAc: null };
  }

  await validateAccountsAssetsInvestmentsBeforeWrite(conn, { parentData, user });

  if (recordId != null && Number.isFinite(recordId) && recordId > 0 && pm === "cash" && !explicitNpa) {
    const mod = modules.accounts_assets_investments;
    const mt = escapeSqlTableIdForModuleConfig(mod);
    await conn.query(`UPDATE ${mt} SET npaCurrentAc = NULL WHERE id = ?`, [recordId]);
  }
}


