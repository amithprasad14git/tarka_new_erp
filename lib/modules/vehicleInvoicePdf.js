/**
 * Vehicle Invoice PDF generator (layout aligned with SARFAESI Invoice — July 2026).
 *
 * What this file does:
 * - Builds a printable A4 PDF for one Vehicle Invoice record.
 * - Prints the same invoice three times: Triplicate, Duplicate, Original.
 * - One full-width charges table from `vehicle_invoice_charges` (config key `vehicle_charges`).
 * - Same header, borrower, account, RCM, and footer pattern as SARFAESI / Recovery.
 *
 * How to print/download:
 * - UI: Vehicle Invoice → Print / post-save acknowledgement (`vehicleInvoiceClient.js`).
 * - API: GET /api/vehicle-invoice/pdf/:id
 *
 * Documentation:
 * - Module guide: README.md#vehicle-invoice-pdf
 * - All invoice PDFs: README.md#invoice--letter-pdfs
 * - Auth: README.md#4-authentication--sessions is unrelated; print uses requireRequestUser on the API route.
 *
 * Layout rules: same as `sarfaesiInvoicePdf.js` (HDR_* vs ACCOUNT_*, case-bank SBI vendor code, wrapped charges).
 *
 * @module vehicleInvoicePdf
 */

import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { rowValueForField } from "../gridRowValue";
import { amountToWordsInr } from "../amountInWords";

/** Millimetres → PDF points (edit the mm constants below, not this). */
const MM_TO_PT = 2.83465;

/** Convert millimetres to PDF points. @param {number} n @returns {number} */
function mm(n) {
  return n * MM_TO_PT;
}

// --- Page copies (one label per page) ---
const COPY_LABELS = [
  "Triplicate - Charges Received Copy",
  "Duplicate - Office Copy",
  "Original - Branch Copy"
];

// --- Fixed wording & colours ---
const COLOR_COPY_GREEN = "#04AA6D";
const COLOR_INVOICE_BLUE = "#0077B3";
const COLOR_SECTION_MAROON = "#6E2842";
const KIND_ATTN = "The Chief / Branch Manager";
const RCM_NOTE =
  "Whether tax payable is under Reverse Charge (RCM): Yes\n" +
  "This Invoice does not include GST, since Banks/Financial Institutions are required to pay taxes under Reverse Charges (RCM) as per the Notification No. 13/2017 of Central Tax (Rate) dated 28/06/2017.";
/** Printed on the account block when case bank code is SBI (see drawAccountWithRcm). */
const SBI_VENDOR_CODE = "NPAE7138220";

// --- Font sizes (points) — +1pt vs Recovery Invoice baseline (July 2026); aligned with sarfaesiInvoicePdf.js ---
const FS_BODY = 11;
const FS_SECTION = 13;
const FS_TABLE_HEAD = 10;
const FS_COPY = 10;
/** RCM auto-fit start size — not tied to FS_BODY. */
const FS_RCM_START = 10;
/** RCM shrinks from FS_RCM_START down to this minimum to fit the account block height. */
const FS_RCM_MIN = 6.5;
/** Hard floor when RCM_NOTE still overflows at FS_RCM_MIN (SamsungSharpSans runs tall). */
const FS_RCM_FLOOR = 5;
const BOX_ROW_H = 19;
/** PDFKit lineGap; wrapped text uses {@link effectiveLineGap}. */
const LINE_GAP = -1;

/** PDFKit lineGap: keep negative for single-line; clamp to 0 when wrapping. @param {boolean} [multiline] @returns {number} */
function effectiveLineGap(multiline = false) {
  return multiline ? Math.max(LINE_GAP, 0) : LINE_GAP;
}

const BOX_LINE_W = 1;
const COLOR_BOX_BORDER = "#a7aec0";
const COLOR_BOX_DIVIDER = "#c3c9d7";
const BOX_PAD_L = 7;
const BOX_PAD_T = 3;
const BOX_COLON_X = 95;
const BOX_VALUE_X = 108;
const ROW_DATA = BOX_ROW_H;
const ROW_HEAD = BOX_ROW_H;
const ROW_TABLE_HEAD = BOX_ROW_H;
const ROW_TEXT = BOX_ROW_H;
const BADGE_BAND_H = mm(10);
const SECTION_GAP = 12;
const CELL_PAD_W = BOX_PAD_L;
const CELL_PAD_H = BOX_PAD_T;
const SIGNATORY_TOP_GAP = mm(12);
const INR_SYMBOL = "\u20B9";

// --- Header grid (Bank / Branch / GST etc.) — FROZEN; tune HDR_* only ---
// Keep HDR_* independent of ACCOUNT_* so moving one block does not break the other.
const HDR_LEFT_W = 108;
const HDR_RIGHT_W = 82;
const HDR_VALUE_GAP_MM = (BOX_VALUE_X - BOX_COLON_X) / MM_TO_PT;
const HDR_LEFT_COLON_MM = 25;
const HDR_LEFT_VALUE_MM = HDR_LEFT_COLON_MM + HDR_VALUE_GAP_MM;
const HDR_RIGHT_COLON_MM = 30;
const HDR_RIGHT_VALUE_MM = HDR_RIGHT_COLON_MM + HDR_VALUE_GAP_MM;

// --- Current account block (left of RCM) — tune ACCOUNT_* only ---
const ACCOUNT_BLOCK_W_MM = 140;
const ACCOUNT_LABEL_COLON_MM = 33;
const ACCOUNT_VALUE_MM = ACCOUNT_LABEL_COLON_MM + HDR_VALUE_GAP_MM;

/** Full-width charges table columns (mm): SL | Particulars | Remarks | Amount */
const CHARGES_COLS_MM = [12, 75, 58, 45];

// --- Formatters / fonts / assets ---

/** Cleans text so PDF fonts render reliably (dashes, spaces; keeps ₹). @param {*} s @returns {string} */
function pdfSafeLine(s) {
  return String(s ?? "")
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/\u00A0/g, " ");
}

/** Amount with ₹ symbol and Indian grouping, e.g. "₹ 1,23,456.00". @param {*} amount @returns {string} */
function formatInrDisplay(amount) {
  const formatted = formatInrAmount(amount);
  return formatted ? `${INR_SYMBOL} ${formatted}` : "";
}

/** Date as DD/MM/YYYY (from ISO string or Date); otherwise returns trimmed string. @param {*} value @returns {string} */
function formatDmySlash(value) {
  if (value == null || value === "") return "";
  const s = String(value).trim();
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const d = String(value.getDate()).padStart(2, "0");
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const y = String(value.getFullYear());
    return `${d}/${m}/${y}`;
  }
  return s;
}

/** Indian-grouped amount with 2 decimals; empty if not a finite number. @param {*} value @returns {string} */
function formatInrAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Prefer particularsLabel lookup text; fall back to raw particulars. @param {object} row @returns {string} */
function particularsDisplay(row) {
  const label = rowValueForField(row, "particularsLabel");
  if (label != null && String(label).trim() !== "") return pdfSafeLine(label);
  const raw = rowValueForField(row, "particulars");
  return raw != null && String(raw).trim() !== "" ? pdfSafeLine(String(raw)) : "";
}

/** Prefer SamsungSharpSans from public/fonts; fall back to Helvetica. @param {PDFKit.PDFDocument} doc @returns {{regular: string, bold: string}} */
function registerPreferredSansFonts(doc) {
  const regularPath = path.join(process.cwd(), "public", "fonts", "SamsungSharpSans-Regular.ttf");
  const boldPath = path.join(process.cwd(), "public", "fonts", "SamsungSharpSans-Bold.ttf");
  if (fs.existsSync(regularPath) && fs.existsSync(boldPath)) {
    doc.registerFont("BrandSans", regularPath);
    doc.registerFont("BrandSans-Bold", boldPath);
    return { regular: "BrandSans", bold: "BrandSans-Bold" };
  }
  return { regular: "Helvetica", bold: "Helvetica-Bold" };
}

/** Resolve public/images/{basename}.{ext} if present. @param {string} basename @returns {string|null} */
function imagePath(basename) {
  const base = String(basename || "").trim();
  if (!base) return null;
  const dir = path.join(process.cwd(), "public", "images");
  for (const ext of [".png", ".jpg", ".jpeg", ".PNG"]) {
    const p = path.join(dir, `${base}${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Safe download filename, e.g. Invoice_INV-2026-001.pdf
 * @param {string} [invoiceNoHint]
 * @returns {string}
 */
export function safeVehicleInvoicePdfFilename(invoiceNoHint) {
  const safe =
    String(invoiceNoHint ?? "")
      .trim()
      .replace(/[^\w./-]+/g, "_")
      .replace(/\//g, "_")
      .slice(0, 120) || "INVOICE";
  return `Invoice_${safe}.pdf`;
}

/** Snapshot doc.x/doc.y so cell draws do not advance flow. @param {PDFKit.PDFDocument} doc @returns {{x: number, y: number}} */
function saveDocCursor(doc) {
  return { x: doc.x, y: doc.y };
}

/** Restore cursor after a non-flowing draw. @param {PDFKit.PDFDocument} doc @param {{x: number, y: number}} saved */
function restoreDocCursor(doc, saved) {
  doc.x = saved.x;
  doc.y = saved.y;
}

// --- Header / label-row draw helpers ---

/**
 * Label row layout: where ":" and the value start.
 * preset "headerLeft" | "headerRight" | "accountLabels" | (default) full-width borrower block.
 * HDR_* and ACCOUNT_* stay independent so tuning one block does not move the other.
 * @param {number} boxX
 * @param {number} boxW
 * @param {string} [preset]
 * @returns {{colonX: number, valueX: number}}
 */
function scaledColonValueX(boxX, boxW, preset) {
  if (preset === "headerLeft") {
    return {
      colonX: boxX + mm(HDR_LEFT_COLON_MM),
      valueX: boxX + mm(HDR_LEFT_VALUE_MM)
    };
  }
  if (preset === "headerRight") {
    return {
      colonX: boxX + mm(HDR_RIGHT_COLON_MM),
      valueX: boxX + mm(HDR_RIGHT_VALUE_MM)
    };
  }
  if (preset === "accountLabels") {
    const scale = boxW / mm(ACCOUNT_BLOCK_W_MM);
    return {
      colonX: boxX + mm(ACCOUNT_LABEL_COLON_MM) * scale,
      valueX: boxX + mm(ACCOUNT_VALUE_MM) * scale
    };
  }
  const scale = boxW / mm(190);
  return {
    colonX: boxX + BOX_COLON_X * scale,
    valueX: boxX + BOX_VALUE_X * scale
  };
}

/** Outer border + faint horizontal row dividers (no vertical columns). */
function drawFaintRowGridChrome(doc, boxX, y, boxW, rowH, rowCount) {
  const totalH = rowCount * rowH;
  doc.save();
  doc.lineWidth(BOX_LINE_W).strokeColor(COLOR_BOX_BORDER);
  doc.rect(boxX, y, boxW, totalH).stroke();
  for (let i = 1; i < rowCount; i++) {
    const ry = y + i * rowH;
    doc.moveTo(boxX, ry).lineTo(boxX + boxW, ry).strokeColor(COLOR_BOX_DIVIDER).stroke();
  }
  doc.restore();
}

/** One label : value line inside a row (does not advance flow). */
function drawBranchLvText(doc, fonts, boxX, y, boxW, rowH, colonX, valueX, label, value, valueColor, textStyle = {}) {
  const saved = saveDocCursor(doc);
  const padL = textStyle.padL ?? BOX_PAD_L;
  const padT = textStyle.padT ?? BOX_PAD_T;
  const fs = textStyle.fontSize ?? FS_BODY;
  const lineGap = effectiveLineGap(false);
  const labelW = Math.max(1, colonX - boxX - padL - 1);
  doc.font(fonts.regular).fontSize(fs).fillColor("#000000");
  doc.text(pdfSafeLine(label), boxX + padL, y + padT, { width: labelW, lineBreak: false, lineGap });
  doc.text(":", colonX, y + padT, { lineBreak: false, lineGap });
  doc.font(fonts.bold).fontSize(fs).fillColor(valueColor ?? "#000000");
  doc.text(pdfSafeLine(value), valueX, y + padT, {
    width: Math.max(1, boxX + boxW - valueX - padL),
    lineBreak: false,
    lineGap
  });
  restoreDocCursor(doc, saved);
}

/** Label/value block — faint horizontal row grid, padding, and colon alignment. @returns {number} y after block */
function drawBranchStyleBlock(doc, fonts, boxX, y, boxW, pairs, colonPreset, textStyle = {}) {
  const { colonX, valueX } = scaledColonValueX(boxX, boxW, colonPreset);
  const rowH = textStyle.rowH ?? BOX_ROW_H;
  drawFaintRowGridChrome(doc, boxX, y, boxW, rowH, pairs.length);
  for (let i = 0; i < pairs.length; i++) {
    const ry = y + i * rowH;
    const [label, value] = pairs[i];
    drawBranchLvText(doc, fonts, boxX, ry, boxW, rowH, colonX, valueX, label, value, undefined, textStyle);
  }
  return y + pairs.length * rowH;
}

/** Draw text inside a fixed box — never advances document flow / never adds pages. */
function drawInCell(doc, fonts, text, x, y, w, h, opts = {}) {
  const saved = saveDocCursor(doc);
  const innerW = Math.max(1, w - CELL_PAD_W * 2);
  const innerH = Math.max(1, h - CELL_PAD_H * 2);
  const safe = pdfSafeLine(text);
  if (safe) {
    const face = opts.bold ? fonts.bold : fonts.regular;
    const fs = opts.fontSize ?? FS_BODY;
    const multiline = opts.lineBreak !== false;
    const lineGap = opts.lineGap ?? effectiveLineGap(multiline);
    doc.font(face).fontSize(fs).fillColor(opts.color ?? "#000000");
    const textH = doc.heightOfString(safe, { width: innerW, lineGap });
    const ty = y + CELL_PAD_H + Math.max(0, (innerH - textH) / 2);
    doc.text(safe, x + CELL_PAD_W, ty, {
      width: innerW,
      height: innerH,
      align: opts.align || "left",
      lineGap,
      lineBreak: multiline
    });
  }
  restoreDocCursor(doc, saved);
}

/** Multiline cell text from top padding (no vertical centering). */
function drawInCellMultiline(doc, fonts, text, x, y, w, h, opts = {}) {
  const saved = saveDocCursor(doc);
  const innerW = Math.max(1, w - CELL_PAD_W * 2);
  const innerH = Math.max(1, h - CELL_PAD_H * 2);
  doc.font(opts.bold ? fonts.bold : fonts.regular).fontSize(opts.fontSize ?? FS_BODY).fillColor(opts.color ?? "#000000");
  doc.text(pdfSafeLine(text), x + CELL_PAD_W, y + CELL_PAD_H, {
    width: innerW,
    height: innerH,
    align: opts.align || "left",
    lineGap: opts.lineGap ?? effectiveLineGap(true),
    lineBreak: true
  });
  restoreDocCursor(doc, saved);
}

/** Flowing single-line text; returns y after text (no extra row box height). @returns {number} */
function drawFlowText(doc, fonts, text, x, y, width, opts = {}) {
  const saved = saveDocCursor(doc);
  const face = opts.fontFace ?? (opts.bold ? fonts.bold : fonts.regular);
  const fs = opts.fontSize ?? FS_BODY;
  const safe = pdfSafeLine(text);
  const lineGap = effectiveLineGap(false);
  doc.font(face).fontSize(fs).fillColor(opts.color ?? "#000000");
  const textH = doc.heightOfString(safe, { width, lineGap });
  doc.text(safe, x, y, { width, align: opts.align || "left", lineGap, lineBreak: false });
  restoreDocCursor(doc, saved);
  return y + textH;
}

/**
 * Top address block: left column (bank/branch) and right column (date/invoice/GST).
 * Uses HDR_* colon positions only — keep independent of ACCOUNT_*.
 * @returns {number} y after header
 */
function drawHeaderBlock(doc, fonts, x, y, contentW, rows) {
  const rightX = x + mm(HDR_LEFT_W);
  const leftW = mm(HDR_LEFT_W);
  const rightW = mm(HDR_RIGHT_W);
  const leftPos = scaledColonValueX(x, leftW, "headerLeft");
  const rightPos = scaledColonValueX(rightX, rightW, "headerRight");
  const totalH = rows.length * BOX_ROW_H;

  drawFaintRowGridChrome(doc, x, y, contentW, BOX_ROW_H, rows.length);

  doc.save();
  doc.lineWidth(BOX_LINE_W).strokeColor(COLOR_BOX_DIVIDER);
  doc.moveTo(rightX, y).lineTo(rightX, y + totalH).stroke();
  doc.restore();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const ry = y + i * BOX_ROW_H;
    drawBranchLvText(
      doc,
      fonts,
      x,
      ry,
      leftW,
      BOX_ROW_H,
      leftPos.colonX,
      leftPos.valueX,
      row.leftLabel,
      row.leftValue
    );
    drawBranchLvText(
      doc,
      fonts,
      rightX,
      ry,
      rightW,
      BOX_ROW_H,
      rightPos.colonX,
      rightPos.valueX,
      row.rightLabel,
      row.rightValue,
      row.rightColor
    );
  }

  return y + totalH;
}

// --- Tables ---

/** Column widths in mm → points. @param {number[]} colsMm @returns {number[]} */
function colWidthsPt(colsMm) {
  return colsMm.map((c) => mm(c));
}

/** Usable text width inside a cell (minus horizontal padding). @param {number} colWidthPt @returns {number} */
function cellInnerWidthPt(colWidthPt) {
  return Math.max(1, colWidthPt - CELL_PAD_W * 2);
}

/** Minimum row height for wrapped charge-line cells (text + vertical padding). */
function measureWrappedCellHeight(doc, fonts, text, colWidthPt, opts = {}) {
  const safe = pdfSafeLine(text);
  if (!safe) return ROW_DATA;
  const face = opts.bold ? fonts.bold : fonts.regular;
  const fs = opts.fontSize ?? FS_BODY;
  const lineGap = opts.lineGap ?? effectiveLineGap(true);
  doc.font(face).fontSize(fs);
  const textH = doc.heightOfString(safe, { width: cellInnerWidthPt(colWidthPt), lineGap });
  return Math.max(ROW_DATA, textH + CELL_PAD_H * 2 + 2);
}

/** Tallest wrapped-cell height for one grid row (particulars/remarks wrap). @returns {number} */
function measureGridRowHeight(doc, fonts, cells, colWidthsPtArr) {
  let maxH = ROW_DATA;
  for (let ci = 0; ci < cells.length; ci++) {
    const cell = cells[ci] || { text: "" };
    const h = measureWrappedCellHeight(doc, fonts, cell.text, colWidthsPtArr[ci] ?? colWidthsPtArr[0], {
      bold: cell.bold,
      fontSize: cell.fontSize
    });
    if (h > maxH) maxH = h;
  }
  return maxH;
}

/** Sum of explicit/default row heights. @param {Array} rows @returns {number} */
function sumTableRowsHeight(rows) {
  return rows.reduce((sum, r) => sum + (r.h ?? ROW_DATA), 0);
}

/**
 * Draw a bordered grid with optional per-row heights; restores cursor after.
 * Cells with wrap:true allow line breaks (charges particulars/remarks).
 * @returns {number} total table height
 */
function drawGridTable(doc, fonts, x, y, colsMm, rows) {
  const saved = saveDocCursor(doc);
  const cw = colWidthsPt(colsMm);
  const totalW = cw.reduce((a, b) => a + b, 0);
  const rowHs = rows.map((r) => r.h ?? ROW_DATA);
  const totalH = rowHs.reduce((a, b) => a + b, 0);

  doc.save();
  doc.lineWidth(BOX_LINE_W).strokeColor(COLOR_BOX_BORDER);
  doc.rect(x, y, totalW, totalH).stroke();
  let ox = x;
  for (let i = 0; i < cw.length - 1; i++) {
    ox += cw[i];
    doc.moveTo(ox, y).lineTo(ox, y + totalH).strokeColor(COLOR_BOX_DIVIDER).stroke();
  }
  let ry = y;
  for (let ri = 0; ri < rowHs.length - 1; ri++) {
    ry += rowHs[ri];
    doc.moveTo(x, ry).lineTo(x + totalW, ry).strokeColor(COLOR_BOX_DIVIDER).stroke();
  }
  doc.restore();

  ry = y;
  for (let ri = 0; ri < rows.length; ri++) {
    const rh = rowHs[ri];
    let cx = x;
    for (let ci = 0; ci < rows[ri].cells.length; ci++) {
      const cell = rows[ri].cells[ci] || { text: "" };
      const w = cw[ci] ?? cw[cw.length - 1];
      drawInCell(doc, fonts, cell.text, cx, ry, w, rh, {
        bold: !!cell.bold,
        align: cell.align || "left",
        color: cell.color,
        fontSize: cell.fontSize,
        lineBreak: cell.wrap === true
      });
      cx += w;
    }
    ry += rh;
  }

  restoreDocCursor(doc, saved);
  return totalH;
}

/** Registered-office footer image at bottom of page (skipped if missing). */
function drawPageFooter(doc) {
  const footerPath = imagePath("npa_regd_off_footer");
  if (!footerPath) return;
  const saved = saveDocCursor(doc);
  try {
    doc.image(footerPath, mm(10), doc.page.height - mm(24), { width: mm(190), height: mm(18) });
  } catch {
    /* skip */
  }
  restoreDocCursor(doc, saved);
}

/** Centered invoice badge band (vehicle art, else recovery fallback); returns y after band. @returns {number} */
function drawInvoiceBadge(doc, leftX, contentW, y) {
  const badgePath = imagePath("npa_vehicle_invoice") || imagePath("npa_recovery_invoice");
  const bandTop = y;
  if (!badgePath) return bandTop + BADGE_BAND_H;
  const saved = saveDocCursor(doc);
  try {
    const badgeW = mm(30);
    const badgeH = mm(8);
    doc.image(badgePath, leftX + contentW / 2 - badgeW / 2, bandTop + (BADGE_BAND_H - badgeH) / 2, {
      width: badgeW,
      height: badgeH
    });
  } catch {
    /* skip */
  }
  restoreDocCursor(doc, saved);
  return bandTop + BADGE_BAND_H;
}

/** TOTAL row: label spans SL+Particulars+Remarks; amount in last column. */
function drawChargesTotalRow(doc, fonts, x, y, colsMm, amountText) {
  const cw = colWidthsPt(colsMm);
  const wLabel = cw[0] + cw[1] + cw[2];
  const wAmt = cw[3];
  doc.save();
  doc.lineWidth(BOX_LINE_W).strokeColor(COLOR_BOX_BORDER);
  doc.rect(x, y, wLabel, ROW_HEAD).stroke();
  doc.rect(x + wLabel, y, wAmt, ROW_HEAD).stroke();
  doc.restore();
  drawInCell(doc, fonts, "TOTAL", x, y, wLabel, ROW_HEAD, {
    bold: true,
    align: "center",
    color: COLOR_SECTION_MAROON,
    fontSize: FS_SECTION,
    lineBreak: false
  });
  drawInCell(doc, fonts, amountText, x + wLabel, y, wAmt, ROW_HEAD, {
    bold: true,
    align: "right",
    color: COLOR_SECTION_MAROON,
    fontSize: FS_SECTION,
    lineBreak: false
  });
}

/**
 * Full-width charges grid — data from `vehicle_invoice_charges` / `vehicle_charges`.
 * No title row; header row is SL / PARTICULARS / REMARKS / AMOUNT. Wraps long text in cols 2–3.
 * @returns {{y: number, totalCharges: number}}
 */
function drawVehicleChargesTable(doc, fonts, leftX, y, chargeRows) {
  const colsMm = CHARGES_COLS_MM;
  const rowCount = chargeRows.length;
  let totalCharges = 0;

  const gridY = y;
  const cw = colWidthsPt(colsMm);

  const headCell = (text) => ({ text, bold: true, align: "center", fontSize: FS_TABLE_HEAD });
  const tableRows = [
    {
      h: ROW_TABLE_HEAD,
      cells: [
        headCell("SL. NO."),
        headCell("PARTICULARS"),
        headCell("REMARKS"),
        headCell("AMOUNT")
      ]
    }
  ];

  for (let i = 0; i < rowCount; i++) {
    const ch = chargeRows[i];
    const cells = [{ text: "" }, { text: "" }, { text: "" }, { text: "" }];
    if (ch) {
      const amt = Number(rowValueForField(ch, "amount"));
      if (Number.isFinite(amt)) totalCharges += amt;
      cells[0] = { text: String(i + 1), align: "center" };
      cells[1] = { text: particularsDisplay(ch), align: "left", wrap: true };
      cells[2] = { text: pdfSafeLine(rowValueForField(ch, "remarks")), align: "left", wrap: true };
      cells[3] = { text: formatInrDisplay(amt), align: "right" };
    }
    const rowH = measureGridRowHeight(doc, fonts, cells, cw);
    tableRows.push({ h: rowH, cells });
  }

  const gridBodyH = sumTableRowsHeight(tableRows);
  drawGridTable(doc, fonts, leftX, gridY, colsMm, tableRows);

  const totalY = gridY + gridBodyH;
  drawChargesTotalRow(
    doc,
    fonts,
    leftX,
    totalY,
    colsMm,
    totalCharges > 0 ? formatInrDisplay(totalCharges) : ""
  );

  return { y: totalY + ROW_HEAD, totalCharges };
}

// --- Account + RCM ---

/**
 * Largest font size so RCM_NOTE fits in a fixed box (height = adjacent account block).
 * @param {PDFKit.PDFDocument} doc
 * @param {{regular: string}} fonts
 * @param {number} w
 * @param {number} h
 * @returns {number}
 */
function fitRcmFontSize(doc, fonts, w, h) {
  const innerW = Math.max(1, w - CELL_PAD_W * 2);
  const innerH = Math.max(1, h - CELL_PAD_H * 2);
  const lineGap = effectiveLineGap(true);
  const safe = pdfSafeLine(RCM_NOTE);
  const maxH = innerH - 1;
  for (let fs = FS_RCM_START; fs >= FS_RCM_FLOOR; fs -= 0.5) {
    doc.font(fonts.regular).fontSize(fs);
    const textH = doc.heightOfString(safe, { width: innerW, lineGap });
    if (textH <= maxH) return fs;
  }
  return FS_RCM_FLOOR;
}

/** Draw justified RCM legal note; font auto-shrinks via fitRcmFontSize (no height clip). */
function drawRcmBlock(doc, fonts, x, y, w, h) {
  const saved = saveDocCursor(doc);
  const innerW = Math.max(1, w - CELL_PAD_W * 2);
  const fontSize = fitRcmFontSize(doc, fonts, w, h);
  const lineGap = effectiveLineGap(true);
  doc.font(fonts.regular).fontSize(fontSize).fillColor("#000000");
  doc.text(pdfSafeLine(RCM_NOTE), x + CELL_PAD_W, y + CELL_PAD_H, {
    width: innerW,
    align: "justify",
    lineGap,
    lineBreak: true
  });
  restoreDocCursor(doc, saved);
}

/**
 * Bank account details (left) and RCM legal note (right), same row height.
 * Vendor code uses case bankCode (SBI only) — not the current-account master bank.
 * @returns {number} y after block + section gap
 */
function drawAccountWithRcm(doc, fonts, leftX, y, contentW, ca, bankCode) {
  const accountW = mm(140);
  const rcmW = contentW - accountW;
  const blockTop = y;

  const pairs = [
    ["Account Name", ca.accountName || ""],
    ["Bank", ca.bankName || ""],
    ["Branch", ca.branch || ""],
    ["CA A/C No.", ca.accountNo || ""],
    ["IFSC Code", ca.ifscCode || ""]
  ];
  if (bankCode === "SBI") pairs.push(["Vendor Code", SBI_VENDOR_CODE]);

  const blockHeight = pairs.length * BOX_ROW_H;
  drawBranchStyleBlock(doc, fonts, leftX, blockTop, accountW, pairs, "accountLabels");
  drawRcmBlock(doc, fonts, leftX + accountW, blockTop, rcmW, blockHeight);

  return blockTop + blockHeight + SECTION_GAP;
}

/** Single-line text in a fixed-height band; returns y after band. @returns {number} */
function drawTextLine(doc, fonts, text, x, y, width, opts = {}) {
  const h = opts.height ?? ROW_TEXT;
  const saved = saveDocCursor(doc);
  const innerW = Math.max(1, width - CELL_PAD_W * 2);
  const innerH = Math.max(1, h - CELL_PAD_H * 2);
  const face = opts.fontFace ?? (opts.bold ? fonts.bold : fonts.regular);
  const fs = opts.fontSize ?? FS_BODY;
  const safe = pdfSafeLine(text);
  doc.font(face).fontSize(fs).fillColor(opts.color ?? "#000000");
  const lineGap = effectiveLineGap(false);
  const textH = doc.heightOfString(safe, { width: innerW, lineGap });
  const ty = y + CELL_PAD_H + Math.max(0, (innerH - textH) / 2);
  doc.text(safe, x + CELL_PAD_W, ty, {
    width: innerW,
    height: innerH,
    align: opts.align || "left",
    lineGap,
    lineBreak: false
  });
  restoreDocCursor(doc, saved);
  return y + h;
}

// --- Page assembly ---

/**
 * Draws one full Vehicle invoice page (logo → footer).
 * @param {PDFKit.PDFDocument} doc
 * @param {{regular: string, bold: string}} fonts
 * @param {string} copyLabel - e.g. "Original - Branch Copy"
 * @param {object} payload
 */
function drawOneCopyPage(doc, fonts, copyLabel, payload) {
  // One A4 page: logo → header → vehicle badge → borrower → charges → amount words → bank/RCM → sign-off → footer.
  const leftX = mm(10);
  const contentW = mm(190);
  const invoice = payload.invoice || {};
  const nci = payload.nciRow || {};
  const bc = payload.branchContext || {};
  const ca = payload.currentAccount || {};

  const header = {
    kindAttn: KIND_ATTN,
    invoiceDate: formatDmySlash(rowValueForField(invoice, "date")),
    bank: pdfSafeLine(bc.bankName || ""),
    invoiceNo: pdfSafeLine(rowValueForField(invoice, "invoiceNo")),
    branch: pdfSafeLine(bc.branchDisplay || ""),
    unit: pdfSafeLine(payload.unitShortCode || ""),
    place: pdfSafeLine(bc.branchPlace || ""),
    caseNo: pdfSafeLine(rowValueForField(nci, "caseNo")),
    rbo: pdfSafeLine(bc.rboName || ""),
    gstNo: pdfSafeLine(String(ca?.gstNo ?? ""))
  };

  let y = mm(10);

  // --- Logo and copy label (Original / Duplicate / Triplicate) ---
  const logoPath = imagePath("npa_full_transparent_bg");
  if (logoPath) {
    const saved = saveDocCursor(doc);
    try {
      doc.image(logoPath, leftX, y, { fit: [mm(130), mm(16)] });
    } catch {
      /* skip */
    }
    restoreDocCursor(doc, saved);
  }
  y += mm(20);

  y = drawFlowText(doc, fonts, copyLabel, leftX, y, contentW, {
    align: "right",
    fontSize: FS_COPY,
    bold: true,
    color: COLOR_COPY_GREEN
  });
  y += SECTION_GAP;
  doc.font(fonts.regular).fontSize(FS_BODY).fillColor("#000000");

  // --- Header block: bank, branch, invoice no, GST ---
  y = drawHeaderBlock(doc, fonts, leftX, y, contentW, [
    { leftLabel: "Kind Attn.", leftValue: header.kindAttn, rightLabel: "Date", rightValue: header.invoiceDate },
    {
      leftLabel: "Bank",
      leftValue: header.bank,
      rightLabel: "Invoice No",
      rightValue: header.invoiceNo,
      rightColor: COLOR_INVOICE_BLUE
    },
    { leftLabel: "Branch", leftValue: header.branch, rightLabel: "Unit", rightValue: header.unit },
    { leftLabel: "Place", leftValue: header.place, rightLabel: "Case No", rightValue: header.caseNo },
    { leftLabel: "RBO/RO", leftValue: header.rbo, rightLabel: "GST No", rightValue: header.gstNo }
  ]);
  y += SECTION_GAP;

  y = drawInvoiceBadge(doc, leftX, contentW, y);
  y += SECTION_GAP;

  // --- Borrower / loan lines ---
  y = drawBranchStyleBlock(doc, fonts, leftX, y, contentW, [
    ["Borrower", rowValueForField(nci, "borrower")],
    ["Loan A/C No", rowValueForField(nci, "loanAccountNo")],
    ["Loan Type", rowValueForField(nci, "loanTypeLabel") ?? rowValueForField(nci, "loanType")]
  ]);
  y += SECTION_GAP;

  // --- Vehicle charge line items and total ---
  const charges = Array.isArray(payload.charges) ? payload.charges : [];
  const { y: afterTable, totalCharges } = drawVehicleChargesTable(doc, fonts, leftX, y, charges);
  y = afterTable + SECTION_GAP;

  const words =
    totalCharges > 0
      ? `Amount in Words: Rupees ${amountToWordsInr(Math.round(totalCharges))} only.`
      : "Amount in Words: Rupees ...................................................................................................................... only";
  y = drawFlowText(doc, fonts, words, leftX, y, contentW, { fontSize: FS_BODY, bold: true });
  y += SECTION_GAP;

  // Vendor code is for the case bank (header), not the current-account master bank (often SBI).
  const bankCode = String(bc.bankCode ?? "").trim().toUpperCase();
  y = drawAccountWithRcm(doc, fonts, leftX, y, contentW, ca, bankCode);
  y += SIGNATORY_TOP_GAP;

  // --- Authorised signatory and registered office footer ---
  drawTextLine(doc, fonts, "Authorised Signatory", leftX, y, contentW, {
    height: ROW_TEXT,
    bold: true,
    align: "right"
  });

  drawPageFooter(doc);
}

/**
 * Builds the full 3-page Vehicle Invoice PDF as a Buffer.
 * @param {object} input - Same shape as `buildSarfaesiInvoicePdfBuffer` (invoice, charges, nciRow, …).
 * @returns {Promise<Buffer>}
 */
export function buildVehicleInvoicePdfBuffer(input) {
  return new Promise((resolve, reject) => {
    // Triplicate layout (Original / Duplicate / Triplicate) — same pattern as recovery/SARFAESI PDFs.
    const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });
    const fonts = registerPreferredSansFonts(doc);
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const payload = {
      invoice: input?.invoice || {},
      charges: input?.charges || [],
      nciRow: input?.nciRow || {},
      branchContext: input?.branchContext || {},
      unitShortCode: input?.unitShortCode || "",
      currentAccount: input?.currentAccount || {}
    };

    COPY_LABELS.forEach((copyLabel, idx) => {
      if (idx > 0) doc.addPage();
      drawOneCopyPage(doc, fonts, copyLabel, payload);
    });

    doc.end();
  });
}

/**
 * @internal Test helper — returns page count for a minimal payload.
 * @param {object} [input]
 * @returns {Promise<number>}
 */
export async function countVehicleInvoicePdfPages(input) {
  const buf = await buildVehicleInvoicePdfBuffer(input);
  const matches = buf.toString("latin1").match(/\/Type\s*\/Page\b/g);
  return matches ? matches.length : 0;
}
