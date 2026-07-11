/**
 * Sync widthHtml across report column configs using report_pending_cases_on_hand as reference.
 * Run: node scripts/dev/sync-report-width-html.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reportsPath = path.join(__dirname, "../../config/reports.js");

/** @type {Record<string, string>} — from report_pending_cases_on_hand */
const WIDTH_BY_KEY = {
  slNo: "4.5rem",
  entrustmentDate: "7rem",
  caseNo: "7.5rem",
  hoZoLabel: "6rem",
  rboRoLabel: "5rem",
  branchLabel: "12rem",
  receivedFromLabel: "6rem",
  borrower: "11rem",
  loanAccountNo: "9rem",
  loanTypeLabel: "7rem",
  npaStatusLabel: "5rem",
  npaDate: "7rem",
  closureBalance: "10rem",
  caseStatusLabel: "8rem",
  amountRecovered: "10rem",
  caseStatusRemarks: "10rem",
  // Same scale — columns in other reports without a pending_cases counterpart
  unitLabel: "6rem",
  bankLabel: "6rem",
  returnDate: "7rem",
  settledDate: "7rem",
  recoveryDate: "7rem",
  invoiceDate: "7rem",
  receivedDate: "7rem",
  date: "7rem",
  chequeDate: "7rem",
  createdDate: "7rem",
  voucherNo: "7.5rem",
  invoiceNo: "7.5rem",
  refNo: "7.5rem",
  chequeNo: "7.5rem",
  branchCode: "7.5rem",
  remarks: "10rem",
  amount: "10rem",
  receiptAmount: "10rem",
  paymentAmount: "10rem",
  grandTotal: "10rem",
  billedAmount: "10rem",
  tdsAmount: "10rem",
  receivedAmount: "10rem",
  paymentMode: "5rem",
  transactionType: "6rem",
  npaCurrentAcLabel: "8rem",
  fromCurrentAcLabel: "8rem",
  toCurrentAcLabel: "8rem",
  expenseCategoryLabel: "8rem",
  paidToLabel: "11rem",
  partyLabel: "11rem",
  inFavourOf: "11rem",
  branchName: "12rem",
  place: "8rem",
  active: "5rem",
  userLabel: "11rem",
  moduleLabel: "8rem",
  action: "5rem",
  recordLabel: "10rem",
  oldData: "10rem",
  newData: "10rem",
  finalInvoice: "5rem",
  tdsPercentage: "5rem",
  roundOff: "5rem"
};

const TYPE_FALLBACK = {
  date: "7rem",
  inr: "10rem",
  number: "5rem"
};

const SKIP_REPORT = "report_pending_cases_on_hand";

let source = fs.readFileSync(reportsPath, "utf8");
let currentReport = null;
let changes = 0;

const lineReportRe = /^\s+(report_[a-z0-9_]+):\s*\{/;
const lineKeyRe = /^\s+key:\s*"([^"]+)"/;
const lineTypeRe = /^\s+type:\s*"([^"]+)"/;
const lineWidthRe = /(\s+widthHtml:\s*)"[^"]+"/;

let pendingKey = null;
let pendingType = null;

const lines = source.split("\n");
const out = lines.map((line) => {
  const reportMatch = line.match(lineReportRe);
  if (reportMatch) {
    currentReport = reportMatch[1];
    pendingKey = null;
    pendingType = null;
    return line;
  }

  const keyMatch = line.match(lineKeyRe);
  if (keyMatch) {
    pendingKey = keyMatch[1];
    pendingType = null;
    return line;
  }

  const typeMatch = line.match(lineTypeRe);
  if (typeMatch && pendingKey) {
    pendingType = typeMatch[1];
    return line;
  }

  const widthMatch = line.match(lineWidthRe);
  if (widthMatch && pendingKey && currentReport && currentReport !== SKIP_REPORT) {
    const next =
      WIDTH_BY_KEY[pendingKey] ||
      (pendingType && TYPE_FALLBACK[pendingType]) ||
      null;
    if (next) {
      const replaced = line.replace(lineWidthRe, `$1"${next}"`);
      if (replaced !== line) {
        changes += 1;
        pendingKey = null;
        pendingType = null;
        return replaced;
      }
    }
  }

  return line;
});

if (changes === 0) {
  console.log("No widthHtml changes needed.");
} else {
  fs.writeFileSync(reportsPath, out.join("\n"), "utf8");
  console.log(`Updated ${changes} widthHtml value(s) in config/reports.js`);
}
