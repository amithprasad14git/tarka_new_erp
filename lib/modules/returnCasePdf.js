/**
 * Return Case PDF — builds the printable “return letter” sent to the bank.
 *
 * In plain terms:
 * - When staff save a Return Case and click Print, this file draws the PDF.
 * - The PDF has **3 identical pages** (Office / RBO / Branch copy labels differ).
 * - Only **checked** return reasons from the child grid appear on the letter.
 *
 * Where it is used:
 * - API: GET /api/return-case/pdf/:id  (server builds the file)
 * - UI: Return Case → Print (view, edit toolbar, or post-save popup)
 *
 * Layout matches invoice PDFs (same fonts, header boxes, footer image).
 * Operator guide: README.md#return-case-letter-pdf
 *
 * @module returnCasePdf
 */

import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { rowValueForField } from "../gridRowValue";

const MM_TO_PT = 2.83465;

/** Convert millimetres (layout design unit) to PDF points (what pdfkit draws in). */
function mm(n) {
  return n * MM_TO_PT;
}

/** Top-right green label on each page — one label per page, same letter body. */
const COPY_LABELS = [
  "Triplicate - Office Copy",
  "Duplicate - RBO/RO/ZO Copy",
  "Original - Branch Copy"
];

const COLOR_REF_BLUE = "#0077B3";
const COLOR_COPY_GREEN = "#04AA6D";
/** Fixed “Kind Attn.” line on every Return Case letter. */
const KIND_ATTN = "The Chief / Branch Manager";

/** Legal paragraph after the reasons table — wording approved for print. */
const ALTERNATIVE_STEPS_TEXT =
  "We kindly suggest that you explore ALTERNATIVE STEPS FOR RECOVERY. Henceforth, we shall not undertake any further recovery proceedings in respect of the said Loan A/C. Please note that WE WILL NOT CLAIM ANY RECOVERY CHARGES for this Loan A/C in the future.";

// --- Typography and spacing (aligned with recovery invoice PDF) ---
const FS_BODY = 9;
/** Slightly smaller font for long Investigating Officer names in the header. */
const FS_HEADER_IO = 7.5;
const FS_COPY = 8;
/** Vertical gap between “for NPA Enforcement Squad” and “Authorised Signatory”. */
const SIGNATORY_GAP = 42;
const BOX_ROW_H = 17;
const ROW_DATA = BOX_ROW_H;
const ROW_TABLE_HEAD = BOX_ROW_H;
const LINE_GAP = -1;

function effectiveLineGap(multiline = false) {
  return multiline ? Math.max(LINE_GAP, 0) : LINE_GAP;
}

const BOX_LINE_W = 0.7;
const COLOR_BOX_BORDER = "#b8bfd1";
const COLOR_BOX_DIVIDER = "#d4dae8";
const COLOR_BOX_DIVIDER_TOP = "#ffffff";
const BOX_PAD_L = 7;
const BOX_PAD_T = 3;
const SECTION_GAP = 12;
const CELL_PAD_W = BOX_PAD_L;
const CELL_PAD_H = BOX_PAD_T;
const INR_SYMBOL = "\u20B9";

const BOX_COLON_X = 95;
const BOX_VALUE_X = 108;
const HDR_LEFT_W = 108;
const HDR_RIGHT_W = 82;
const HDR_VALUE_GAP_MM = (BOX_VALUE_X - BOX_COLON_X) / MM_TO_PT;
const HDR_LEFT_COLON_MM = 25;
const HDR_LEFT_VALUE_MM = HDR_LEFT_COLON_MM + HDR_VALUE_GAP_MM;
const HDR_RIGHT_COLON_MM = 30;
const HDR_RIGHT_VALUE_MM = HDR_RIGHT_COLON_MM + HDR_VALUE_GAP_MM;

/** Table column widths for “Sl. No.” and “Reason/Remarks” (mm; total page content width 190). */
const DETAILS_COLS_MM = [14, 176];

/** Clean text so PDF fonts do not break on odd dashes or non-breaking spaces. */
function pdfSafeLine(s) {
  return String(s ?? "")
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/\u00A0/g, " ");
}

/** Format dates as DD/MM/YYYY for the letter (accepts ISO strings or Date objects). */
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

/** Indian number format for closure balance, e.g. 1,00,000.00 */
function formatInrAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Closure balance with ₹ symbol for the header block. */
function formatInrDisplay(amount) {
  const formatted = formatInrAmount(amount);
  return formatted ? `${INR_SYMBOL} ${formatted}` : "";
}

/**
 * Keep only child rows the user ticked “Select” on — same rule as save and PDF print.
 * @param {object[]} rows — return_case_details lines from the database
 */
export function filterSelectedReturnCaseDetails(rows) {
  return (rows || []).filter((row) => row?.select === true || Number(row?.select) === 1);
}

/** Use company Samsung fonts when present; otherwise fall back to Helvetica. */
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

/** Find logo/footer image under public/images (tries .png / .jpg). */
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
 * Safe download file name, e.g. ref RC/2627/0001 → RETURN_RC_2627_0001.pdf
 * @param {string} refHint — usually return_case.refNo
 */
export function safeReturnCasePdfFilename(refHint) {
  const safe =
    String(refHint ?? "")
      .trim()
      .replace(/[^\w./-]+/g, "_")
      .replace(/\//g, "_")
      .slice(0, 120) || "CASE";
  return `RETURN_${safe}.pdf`;
}

function saveDocCursor(doc) {
  return { x: doc.x, y: doc.y };
}

function restoreDocCursor(doc, saved) {
  doc.x = saved.x;
  doc.y = saved.y;
}

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
  const scale = boxW / mm(190);
  return {
    colonX: boxX + BOX_COLON_X * scale,
    valueX: boxX + BOX_VALUE_X * scale
  };
}

function drawBranchRowBorders(doc, boxX, y, boxW, rowH, isFirst, isLast) {
  doc.rect(boxX, y, boxW, rowH).lineWidth(BOX_LINE_W).strokeColor(COLOR_BOX_BORDER).stroke();
  if (!isFirst) {
    doc.moveTo(boxX, y).lineTo(boxX + boxW, y).strokeColor(COLOR_BOX_DIVIDER_TOP).stroke();
  }
  if (!isLast) {
    doc.moveTo(boxX, y + rowH).lineTo(boxX + boxW, y + rowH).strokeColor(COLOR_BOX_DIVIDER).stroke();
  }
}

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

/** Two-column bordered header (bank / date, branch / ref no, etc.). */
function drawHeaderBlock(doc, fonts, x, y, contentW, rows) {
  const rightX = x + mm(HDR_LEFT_W);
  const leftW = mm(HDR_LEFT_W);
  const rightW = mm(HDR_RIGHT_W);
  const leftPos = scaledColonValueX(x, leftW, "headerLeft");
  const rightPos = scaledColonValueX(rightX, rightW, "headerRight");

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const ry = y + i * BOX_ROW_H;
    drawBranchRowBorders(doc, x, ry, contentW, BOX_ROW_H, i === 0, i === rows.length - 1);
    doc.save();
    doc.lineWidth(BOX_LINE_W).strokeColor(COLOR_BOX_DIVIDER);
    doc.moveTo(rightX, ry).lineTo(rightX, ry + BOX_ROW_H).stroke();
    doc.restore();
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
      row.rightLabel ?? "",
      row.rightValue ?? "",
      row.rightColor,
      row.rightValueFontSize != null ? { fontSize: row.rightValueFontSize } : undefined
    );
  }

  return y + rows.length * BOX_ROW_H;
}

/** Plain paragraph text in the letter body (not inside a table cell). */
function drawFlowText(doc, fonts, text, x, y, width, opts = {}) {
  const saved = saveDocCursor(doc);
  const face = opts.fontFace ?? (opts.bold ? fonts.bold : fonts.regular);
  const fs = opts.fontSize ?? FS_BODY;
  const safe = pdfSafeLine(text);
  const lineGap = effectiveLineGap(opts.multiline === true);
  doc.font(face).fontSize(fs).fillColor(opts.color ?? "#000000");
  const textH = doc.heightOfString(safe, { width, lineGap });
  doc.text(safe, x, y, {
    width,
    align: opts.align || "left",
    lineGap,
    lineBreak: opts.multiline === true
  });
  restoreDocCursor(doc, saved);
  return y + textH;
}

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

function colWidthsPt(colsMm) {
  return colsMm.map((c) => mm(c));
}

function cellInnerWidthPt(colWidthPt) {
  return Math.max(1, colWidthPt - CELL_PAD_W * 2);
}

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
  return y + totalH;
}

/** Reasons table — one row per checked return reason, with wrapped text in the remarks column. */
function drawDetailsTable(doc, fonts, x, y, details) {
  const cw = colWidthsPt(DETAILS_COLS_MM);
  const rows = [
    {
      h: ROW_TABLE_HEAD,
      cells: [
        { text: "Sl. No.", bold: true, align: "center" },
        { text: "Reason/Remarks", bold: true, align: "center" }
      ]
    }
  ];

  for (let i = 0; i < details.length; i++) {
    const reason = pdfSafeLine(rowValueForField(details[i], "returnReason"));
    const cells = [
      { text: String(i + 1), wrap: false, align: "center" },
      { text: reason, wrap: true, align: "left" }
    ];
    let maxH = ROW_DATA;
    for (let ci = 0; ci < cells.length; ci++) {
      const h = measureWrappedCellHeight(doc, fonts, cells[ci].text, cw[ci], {
        bold: cells[ci].bold
      });
      if (h > maxH) maxH = h;
    }
    rows.push({ h: maxH, cells });
  }

  return drawGridTable(doc, fonts, x, y, DETAILS_COLS_MM, rows);
}

function measureBorrowerLatestBoxHeight(doc, fonts, w, text) {
  const innerW = Math.max(1, w - CELL_PAD_W * 2);
  doc.font(fonts.regular).fontSize(FS_BODY);
  const bodyH = doc.heightOfString(pdfSafeLine(text), {
    width: innerW,
    lineGap: effectiveLineGap(true)
  });
  return ROW_TABLE_HEAD + Math.max(ROW_DATA, bodyH + CELL_PAD_H * 2 + 2);
}

/** Optional bordered box for free-text “Borrower Latest Details” from the parent form. */
function drawBorrowerLatestDetailsBox(doc, fonts, x, y, w, text) {
  const headerRow = {
    h: ROW_TABLE_HEAD,
    cells: [{ text: "Borrower Latest Details", bold: true, align: "left" }]
  };
  const bodyH = measureBorrowerLatestBoxHeight(doc, fonts, w, text) - ROW_TABLE_HEAD;
  const rows = [
    headerRow,
    {
      h: bodyH,
      cells: [{ text: pdfSafeLine(text), wrap: true, align: "left" }]
    }
  ];
  return drawGridTable(doc, fonts, x, y, [190], rows);
}

/** Registered office strip at the bottom of every page. */
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

/**
 * Draw one full page of the Return Case letter (logo → headers → body → sign-off → footer).
 * @param {string} copyLabel — e.g. “Triplicate - Office Copy”
 * @param {object} payload — return case, linked case, branch, and selected detail rows
 */
function drawReturnCasePage(doc, fonts, copyLabel, payload) {
  const leftX = mm(10);
  const contentW = mm(190);
  const rc = payload.returnCase || {};
  const nci = payload.nciRow || {};
  const bc = payload.branchContext || {};
  const details = Array.isArray(payload.returnCaseDetails) ? payload.returnCaseDetails : [];
  const borrowerLatest = pdfSafeLine(payload.borrowerLatestDetails ?? rowValueForField(rc, "borrowerLatestDetails"));
  const ccTo = pdfSafeLine(payload.ccTo ?? rowValueForField(rc, "ccTo"));

  const header = {
    kindAttn: KIND_ATTN,
    bank: pdfSafeLine(bc.bankName || ""),
    branch: pdfSafeLine(bc.branchDisplay || ""),
    place: pdfSafeLine(bc.branchPlace || ""),
    rbo: pdfSafeLine(bc.rboName || ""),
    date: formatDmySlash(rowValueForField(rc, "date")),
    refNo: pdfSafeLine(rowValueForField(rc, "refNo")),
    unit: pdfSafeLine(payload.unitShortCode || ""),
    caseNo: pdfSafeLine(rowValueForField(nci, "caseNo"))
  };

  const investigatingOfficer =
    pdfSafeLine(rowValueForField(rc, "investigatingOfficerLabel")) ||
    pdfSafeLine(rowValueForField(rc, "investigatingOfficer"));

  let y = mm(10);

  // --- Logo and copy label (top of page) ---
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

  // --- Header 1: bank / branch / RBO and date / ref / unit / case no ---
  y = drawHeaderBlock(doc, fonts, leftX, y, contentW, [
    { leftLabel: "Kind Attn.", leftValue: header.kindAttn, rightLabel: "Date", rightValue: header.date },
    {
      leftLabel: "Bank",
      leftValue: header.bank,
      rightLabel: "Ref No",
      rightValue: header.refNo,
      rightColor: COLOR_REF_BLUE
    },
    { leftLabel: "Branch", leftValue: header.branch, rightLabel: "Unit", rightValue: header.unit },
    { leftLabel: "RBO/RO", leftValue: header.rbo, rightLabel: "Case No", rightValue: header.caseNo }
  ]);
  y += SECTION_GAP;

  // --- Header 2: borrower / loan details and IO / entrustment / closure balance ---
  y = drawHeaderBlock(doc, fonts, leftX, y, contentW, [
    {
      leftLabel: "Borrower",
      leftValue: pdfSafeLine(rowValueForField(nci, "borrower")),
      rightLabel: "Entrustment Date",
      rightValue: formatDmySlash(rowValueForField(nci, "entrustmentDate"))
    },
    {
      leftLabel: "Loan AC",
      leftValue: pdfSafeLine(rowValueForField(nci, "loanAccountNo")),
      rightLabel: "Investigating Officer",
      rightValue: investigatingOfficer,
      rightValueFontSize: FS_HEADER_IO
    },
    {
      leftLabel: "Loan Category",
      leftValue: pdfSafeLine(rowValueForField(nci, "loanCategoryLabel") ?? rowValueForField(nci, "loanCategory")),
      rightLabel: "Loan Type",
      rightValue: pdfSafeLine(rowValueForField(nci, "loanTypeLabel") ?? rowValueForField(nci, "loanType"))
    },
    {
      leftLabel: "NPA Status",
      leftValue: pdfSafeLine(rowValueForField(nci, "npaStatusLabel") ?? rowValueForField(nci, "npaStatus")),
      rightLabel: "Closure Bal",
      rightValue: formatInrDisplay(rowValueForField(nci, "closureBalance"))
    }
  ]);
  y += SECTION_GAP;

  // --- Letter body (salutation, subject, intro, reasons lead-in) ---
  y = drawFlowText(doc, fonts, "Respected Sir / Madam,", leftX, y, contentW);
  y += SECTION_GAP;
  y = drawFlowText(doc, fonts, "Sub: RETURNING of NPA A/C Due to Non-Recovery", leftX, y, contentW, { bold: true });
  y += SECTION_GAP;
  y = drawFlowText(
    doc,
    fonts,
    "Inspite of our several recovery attempts and strategies, we could not recover the loan amount. Based on our Investigating Officer's report, we are RETURNING you the above mentioned Loan A/C",
    leftX,
    y,
    contentW,
    { multiline: true }
  );
  y += SECTION_GAP;
  y = drawFlowText(doc, fonts, "The reasons/remarks for returning are as follows:", leftX, y, contentW);
  y += SECTION_GAP;

  if (details.length) {
    y = drawDetailsTable(doc, fonts, leftX, y, details);
    y += SECTION_GAP;
  }

  // --- Fixed legal paragraph (alternative recovery / no future charges) ---
  y = drawFlowText(doc, fonts, ALTERNATIVE_STEPS_TEXT, leftX, y, contentW, { multiline: true });
  y += SECTION_GAP;

  if (borrowerLatest) {
    y = drawBorrowerLatestDetailsBox(doc, fonts, leftX, y, contentW, borrowerLatest);
    y += SECTION_GAP;
  }

  y = drawFlowText(doc, fonts, "for NPA Enforcement Squad", leftX, y, contentW);
  y += SIGNATORY_GAP;
  y = drawFlowText(doc, fonts, "Authorised Signatory", leftX, y, contentW);

  // --- CC line (optional, after signatory, bold) ---
  if (ccTo) {
    y += SECTION_GAP;
    y = drawFlowText(doc, fonts, `CC to: ${ccTo}`, leftX, y, contentW, { multiline: true, bold: true });
  }

  drawPageFooter(doc);
}

/**
 * Build the full Return Case PDF as a buffer (3 pages).
 * Called by app/api/return-case/pdf/[id]/route.js after data is loaded from the database.
 *
 * @param {object} input.returnCase — saved Return Case parent row
 * @param {object} input.nciRow — linked New Case Inward row (borrower, loan A/C, …)
 * @param {object} input.branchContext — bankName, branchDisplay, rboName (from branch master)
 * @param {string} input.unitShortCode — unit code from unit master
 * @param {object[]} [input.returnCaseDetails] — checked return_case_details rows only
 * @param {string} [input.borrowerLatestDetails] — optional free text for the letter
 * @param {string} [input.ccTo] — optional CC recipients line
 */
export function buildReturnCasePdfBuffer(input) {
  // Three letter copies (office / branch / file) — one page each via drawReturnCasePage.
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });
    const fonts = registerPreferredSansFonts(doc);
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    COPY_LABELS.forEach((copyLabel, idx) => {
      if (idx > 0) doc.addPage({ size: "A4", margin: 0 });
      drawReturnCasePage(doc, fonts, copyLabel, input || {});
    });

    doc.end();
  });
}

/** Count pages in a generated PDF — used by tests to confirm triplicate output. */
export async function countReturnCasePdfPages(input) {
  const buf = await buildReturnCasePdfBuffer(input);
  const s = buf.toString("latin1");
  const matches = s.match(/\/Type\s*\/Page\b/g);
  return matches ? matches.length : 0;
}
