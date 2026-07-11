// Module PDF layout — draws printable pages (pdfkit).

// Module-specific file: SARFAESI Case Status Update covering sheets only.
// Do not move this logic into generic/shared files.
// Operator guide: README.md#sarfaesi-covering-sheet-pdfs

/**
 * SARFAESI Case Status Update — 13(2) Demand Notice covering sheet PDF.
 *
 * Plain-language intent:
 * - One A4 page cut into two equal halves (Branch / RBO copy labels).
 * - Covering Sheet uses Date of 13(2) child remarks; Paper Publication uses
 *   “13(2) Acknowledgements Received?” remarks and different title/intro/note.
 *
 * API: GET /api/sarfaesi-case-status-update/covering-132-pdf/:id
 * API: GET /api/sarfaesi-case-status-update/covering-132-paper-publication-pdf/:id
 * UI: Print 13/2 Covering Sheet / Print 13/2 Paper Publication (view row / edit toolbar).
 *
 * @module sarfaesiCaseStatusUpdateCovering132Pdf
 */

import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { getYmdISTFromInstant } from "../istDateTime";
import { rowValueForField } from "../gridRowValue";

const COPY_LABELS = [
  "Branch Copy / AO Copy / ZO Copy",
  "RBO/RO Copy / AMCC Copy / HLC Copy"
];

const COLOR_COPY_GREEN = "#04AA6D";
const COLOR_TITLE_BLUE = "#0077B3";
const COLOR_ACCENT_RED = "#C0392B";
const COLOR_BOX_BORDER = "#222222";
const COLOR_BOX_DIVIDER = "#222222";

/** Font sizes — readable print scale (legacy-like). */
const FS_BODY = 11;
const FS_TITLE = 14;
const FS_TITLE_PAPER_PUB = 12;
const FS_COPY = 11;
const FS_NOTE = 8;
const FS_TABLE = 10.5;
const FS_FOOTER = 10;

const FOOTER_H = 40;
const SECTION_GAP = 13;
const HEADER_ROW_H = 22;
const HEADER_ROWS = 4;
const HALF_TOP_PAD = 18;
const PAGE_MARGIN = 36;
const BOX_LINE_W = 1;
/** Match Branch Copy logo presence (scaled for half-page). */
const LOGO_W = 300;
const LOGO_H = 54;

// --- Fixed letter wording (Covering Sheet vs Paper Publication) ---

export const COVERING_132_TITLE = "13(2) DEMAND NOTICE";

export const COVERING_132_INTRO =
  "We confirm the particulars of the 13(2) Demand Notice issued in respect of the loan account mentioned above. Kindly take the same on record.";

export const COVERING_132_NOTE =
  "Note: The 13(2) Demand Notice has been despatched to the Borrower(s)/Guarantor(s)/Mortgagor(s) through Speed Post with Acknowledgement Due. Please retain the postal acknowledgements or returned envelopes carefully for the Bank's record and for any further SARFAESI proceedings. If you do not receive the same within 15 days, please inform us immediately to proceed for paper publication.";

export const COVERING_132_PAPER_PUB_TITLE = "13(2) DEMAND NOTICE - PAPER PUBLICATION";

export const COVERING_132_PAPER_PUB_INTRO =
  "We confirm paper publication of the 13(2) Demand Notice for the loan account mentioned above. Kindly take the same on record.";

export const COVERING_132_PAPER_PUB_NOTE =
  "Note: As the acknowledgements for the 13(2) Demand Notice despatched by Speed Post with Acknowledgement Due were not received, the Demand Notice has been published in the newspaper(s) by way of paper publication. Please retain the publication cuttings and proof of publication carefully for the Bank's record and for any further SARFAESI proceedings.";

function pdfSafeLine(s) {
  return String(s ?? "")
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/\u20B9/g, "Rs.");
}

function formatDmySlash(value) {
  if (value == null || value === "") return "";
  const s = String(value).trim();
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    return `${dmy[1].padStart(2, "0")}/${dmy[2].padStart(2, "0")}/${dmy[3]}`;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const d = String(value.getDate()).padStart(2, "0");
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const y = String(value.getFullYear());
    return `${d}/${m}/${y}`;
  }
  return s;
}

function todayDmyIST() {
  const ymd = getYmdISTFromInstant(new Date());
  return formatDmySlash(ymd);
}

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

function saveDocCursor(doc) {
  return { x: doc.x, y: doc.y };
}

function restoreDocCursor(doc, saved) {
  doc.x = saved.x;
  doc.y = saved.y;
}

function detailParticularLabel(row) {
  return (
    rowValueForField(row, "particularsLabel") ?? rowValueForField(row, "particulars") ?? ""
  );
}

/** Match a particulars label that refers to 13(2) notice date (not acknowledgements). */
export function isCovering132ParticularLabel(label) {
  const s = String(label ?? "");
  if (/acknowledgements?\s+received/i.test(s)) return false;
  return /13\s*\(?\s*2\s*\)?/i.test(s);
}

/** Match “13(2) Acknowledgements Received?” (optional punctuation). */
export function isCovering132PaperPublicationParticularLabel(label) {
  return /13\s*\(?\s*2\s*\)?\s*Acknowledgements?\s+Received/i.test(String(label ?? ""));
}

/**
 * Resolve Date of 13(2) from child remarks (particular match) or parent date.
 * @param {object[]} detailRows
 * @param {unknown} parentDate
 */
export function resolveDateOf132(detailRows, parentDate) {
  const rows = Array.isArray(detailRows) ? detailRows : [];
  for (const row of rows) {
    if (!isCovering132ParticularLabel(detailParticularLabel(row))) continue;
    const remarks = String(rowValueForField(row, "remarks") ?? "").trim();
    if (remarks) return formatDmySlash(remarks);
  }
  return formatDmySlash(parentDate);
}

/**
 * Resolve date box from “13(2) Acknowledgements Received?” remarks, else parent date.
 * @param {object[]} detailRows
 * @param {unknown} parentDate
 */
export function resolvePaperPublicationDate(detailRows, parentDate) {
  const rows = Array.isArray(detailRows) ? detailRows : [];
  for (const row of rows) {
    if (!isCovering132PaperPublicationParticularLabel(detailParticularLabel(row))) continue;
    const remarks = String(rowValueForField(row, "remarks") ?? "").trim();
    if (remarks) return formatDmySlash(remarks);
  }
  return formatDmySlash(parentDate);
}

export function safeSarfaesiCovering132PdfFilename(refHint) {
  const safe =
    String(refHint ?? "")
      .trim()
      .replace(/[^\w./-]+/g, "_")
      .replace(/\//g, "_")
      .slice(0, 120) || "SHEET";
  return `COVERING_132_${safe}.pdf`;
}

export function safeSarfaesiCovering132PaperPublicationPdfFilename(refHint) {
  const safe =
    String(refHint ?? "")
      .trim()
      .replace(/[^\w./-]+/g, "_")
      .replace(/\//g, "_")
      .slice(0, 120) || "SHEET";
  return `COVERING_132_PAPER_PUB_${safe}.pdf`;
}

/** Scissors via ZapfDingbats (brand fonts lack ✂). Mid-page cut guide between halves. */
function drawDashedCutGuide(doc, y, left, width) {
  doc.save();
  doc.strokeColor("#888888").lineWidth(0.7).dash(5, { space: 3 });
  doc.moveTo(left, y).lineTo(left + width, y).stroke();
  doc.undash();
  doc.restore();

  const label = " Cut here";
  const iconSize = 10;
  doc.font("ZapfDingbats").fontSize(iconSize).fillColor("#888888");
  const icon = String.fromCharCode(34); // scissors
  const iconW = doc.widthOfString(icon);
  doc.fontSize(8);
  const textW = doc.widthOfString(label);
  const totalW = iconW + textW;
  const startX = left + (width - totalW) / 2;
  const labelY = y - 11;
  doc.font("ZapfDingbats").fontSize(iconSize);
  doc.text(icon, startX, labelY - 1, { lineBreak: false });
  doc.font("Helvetica").fontSize(8);
  doc.text(label, startX + iconW, labelY, { lineBreak: false });
  doc.fillColor("#000000");
}

/**
 * Full-width case fields table (Branch / Borrower / Loan AC / Loan Type).
 */
function drawCaseFieldsHeader(doc, fonts, x, y, w, ctx) {
  const labelW = 90;
  const totalH = HEADER_ROWS * HEADER_ROW_H;
  const pad = 8;

  const branchRight =
    [ctx.branchDisplay, ctx.rboName].filter(Boolean).join(" - ") || ctx.branchDisplay || "";
  const rows = [
    { label: "Branch", value: branchRight },
    { label: "Borrower", value: ctx.borrower || "", valueColor: COLOR_ACCENT_RED },
    { label: "Loan AC No", value: ctx.loanAccountNo || "", valueColor: COLOR_ACCENT_RED },
    { label: "Loan Type", value: ctx.loanType || "" }
  ];

  doc.save();
  doc.lineWidth(BOX_LINE_W).strokeColor(COLOR_BOX_BORDER);
  doc.rect(x, y, w, totalH).stroke();
  for (let i = 1; i < HEADER_ROWS; i++) {
    const ry = y + i * HEADER_ROW_H;
    doc.moveTo(x, ry).lineTo(x + w, ry).strokeColor(COLOR_BOX_DIVIDER).stroke();
  }
  doc
    .moveTo(x + labelW, y)
    .lineTo(x + labelW, y + totalH)
    .strokeColor(COLOR_BOX_DIVIDER)
    .stroke();
  doc.restore();

  for (let i = 0; i < HEADER_ROWS; i++) {
    const ry = y + i * HEADER_ROW_H;
    const rr = rows[i];
    doc.font(fonts.regular).fontSize(FS_TABLE).fillColor("#000000");
    doc.text(pdfSafeLine(rr.label), x + pad, ry + 5, {
      width: labelW - pad * 2,
      lineBreak: false
    });
    doc.font(fonts.bold).fontSize(FS_TABLE).fillColor(rr.valueColor || "#000000");
    doc.text(pdfSafeLine(rr.value), x + labelW + pad, ry + 5, {
      width: w - labelW - pad * 2,
      lineBreak: false
    });
  }
  doc.fillColor("#000000");
  return y + totalH;
}

/** Blue date box; `dateBoxLabel` differs for Covering vs Paper Publication. */
function drawDateOf132Box(doc, fonts, x, y, w, dateText, dateBoxLabel) {
  const h = 30;
  const label = dateBoxLabel || "Date of 13(2)";
  doc.font(fonts.bold).fontSize(FS_BODY);
  const needed = Math.ceil(doc.widthOfString(label)) + 16;
  const labelW = Math.min(Math.max(needed, 118), Math.round(w * 0.45));
  doc.save();
  doc.lineWidth(BOX_LINE_W).strokeColor(COLOR_TITLE_BLUE);
  doc.rect(x, y, w, h).stroke();
  doc.moveTo(x + labelW, y).lineTo(x + labelW, y + h).stroke();
  doc.restore();
  doc.font(fonts.bold).fontSize(FS_BODY).fillColor(COLOR_TITLE_BLUE);
  doc.text(label, x + 6, y + 8, { width: labelW - 12, align: "center", lineBreak: false });
  doc.text(pdfSafeLine(dateText || "—"), x + labelW + 8, y + 8, {
    width: w - labelW - 16,
    align: "center",
    lineBreak: false
  });
  doc.fillColor("#000000");
  return y + h;
}

/**
 * One half of the A4 sheet (top or bottom).
 * Order: logo → copy label → title → case fields → intro → date box → note → footer.
 * Footer is pinned to the bottom of the half (room above for a hand stamp).
 * @param {{ title: string, intro: string, note: string, titleSize: number, dateBoxLabel?: string }} variant
 */
function drawHalf(doc, fonts, topY, halfH, copyLabel, ctx, variant) {
  const left = PAGE_MARGIN;
  const contentW = doc.page.width - PAGE_MARGIN * 2;
  const footerY = topY + halfH - FOOTER_H - 8;
  let y = topY + HALF_TOP_PAD;
  const titleSize = variant.titleSize || FS_TITLE;

  const logoPath = imagePath("npa_full_transparent_bg") || imagePath("npa_without_addr");
  if (logoPath) {
    const saved = saveDocCursor(doc);
    try {
      doc.image(logoPath, left, y, { fit: [LOGO_W, LOGO_H] });
    } catch {
      /* skip */
    }
    restoreDocCursor(doc, saved);
  }
  y += LOGO_H + 6;

  doc.font(fonts.bold).fontSize(FS_COPY).fillColor(COLOR_COPY_GREEN);
  doc.text(copyLabel, left, y, { width: contentW, align: "right", lineBreak: false });
  doc.fillColor("#000000");
  y += FS_COPY + 12;

  doc.font(fonts.bold).fontSize(titleSize).fillColor(COLOR_TITLE_BLUE);
  doc.text(variant.title, left, y, { width: contentW, align: "center", lineBreak: false });
  doc.fillColor("#000000");
  y += titleSize + 14;

  y = drawCaseFieldsHeader(doc, fonts, left, y, contentW, ctx) + SECTION_GAP;

  doc.font(fonts.regular).fontSize(FS_BODY).fillColor("#000000");
  doc.text(variant.intro, left, y, { width: contentW, align: "justify", lineGap: 3 });
  y = doc.y + SECTION_GAP;

  y = drawDateOf132Box(doc, fonts, left, y, contentW, ctx.dateOf132, variant.dateBoxLabel) +
    SECTION_GAP;

  const noteMaxBottom = footerY - 10;
  const noteBody = String(variant.note || "").replace(/^Note:\s*/i, "");
  doc.font(fonts.bold).fontSize(FS_NOTE).fillColor(COLOR_ACCENT_RED);
  doc.text(`PLEASE NOTE: ${noteBody}`, left, y, {
    width: contentW,
    align: "justify",
    lineGap: 3,
    height: Math.max(28, noteMaxBottom - y)
  });
  doc.fillColor("#000000");

  doc.font(fonts.regular).fontSize(FS_FOOTER).fillColor("#333333");
  doc.text(`Printed On: ${ctx.printedOn || ""}`, left, footerY + 14, { lineBreak: false });

  const sigX = left + contentW - 145;
  doc.strokeColor("#555555").lineWidth(0.7);
  doc.moveTo(sigX, footerY + 12).lineTo(sigX + 135, footerY + 12).stroke();
  doc.font(fonts.regular).fontSize(FS_BODY).fillColor("#000000");
  doc.text(pdfSafeLine(ctx.signatoryName || ""), sigX, footerY + 16, {
    width: 135,
    align: "center",
    lineBreak: false
  });
}

function buildCoveringCtx(input, resolveDateFn) {
  const statusUpdate = input?.statusUpdate || {};
  const nci = input?.nciRow || {};
  const bc = input?.branchContext || {};
  const detailRows = Array.isArray(input?.detailRows) ? input.detailRows : [];

  return {
    bankName: pdfSafeLine(bc.bankName || ""),
    branchDisplay: pdfSafeLine(bc.branchDisplay || ""),
    branchPlace: pdfSafeLine(bc.branchPlace || ""),
    rboName: pdfSafeLine(bc.rboName || ""),
    borrower: pdfSafeLine(rowValueForField(nci, "borrower")),
    loanAccountNo: pdfSafeLine(rowValueForField(nci, "loanAccountNo")),
    loanType: pdfSafeLine(
      rowValueForField(nci, "loanTypeLabel") ?? rowValueForField(nci, "loanType")
    ),
    dateOf132: resolveDateFn(detailRows, rowValueForField(statusUpdate, "date")),
    printedOn: todayDmyIST(),
    signatoryName: pdfSafeLine(input?.signatoryName || "")
  };
}

function buildCoveringPdfBuffer(input, variant, resolveDateFn) {
  const ctx = buildCoveringCtx(input, resolveDateFn);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });
    const fonts = registerPreferredSansFonts(doc);
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageH = doc.page.height;
    const halfH = pageH / 2;
    const contentLeft = PAGE_MARGIN;
    const contentW = doc.page.width - PAGE_MARGIN * 2;

    drawHalf(doc, fonts, 0, halfH, COPY_LABELS[0], ctx, variant);
    drawDashedCutGuide(doc, halfH, contentLeft, contentW);
    drawHalf(doc, fonts, halfH, halfH, COPY_LABELS[1], ctx, variant);

    doc.end();
  });
}

/**
 * @param {object} input
 * @param {object} [input.statusUpdate]
 * @param {object} [input.nciRow]
 * @param {object} [input.branchContext]
 * @param {string} [input.signatoryName]
 * @param {object[]} [input.detailRows]
 */
export function buildSarfaesiCovering132PdfBuffer(input) {
  return buildCoveringPdfBuffer(
    input,
    {
      title: COVERING_132_TITLE,
      intro: COVERING_132_INTRO,
      note: COVERING_132_NOTE,
      titleSize: FS_TITLE,
      dateBoxLabel: "Date of 13(2)"
    },
    resolveDateOf132
  );
}

/**
 * Paper publication variant — same layout; different title/intro/note/date particular.
 * @param {object} input
 */
export function buildSarfaesiCovering132PaperPublicationPdfBuffer(input) {
  return buildCoveringPdfBuffer(
    input,
    {
      title: COVERING_132_PAPER_PUB_TITLE,
      intro: COVERING_132_PAPER_PUB_INTRO,
      note: COVERING_132_PAPER_PUB_NOTE,
      titleSize: FS_TITLE_PAPER_PUB,
      dateBoxLabel: "13(2) Paper Publication"
    },
    resolvePaperPublicationDate
  );
}

/** @internal Test helper */
export async function countSarfaesiCovering132PdfPages(input) {
  const buf = await buildSarfaesiCovering132PdfBuffer(input);
  const matches = buf.toString("latin1").match(/\/Type\s*\/Page\b/g);
  return matches ? matches.length : 0;
}

/** @internal Test helper */
export async function countSarfaesiCovering132PaperPublicationPdfPages(input) {
  const buf = await buildSarfaesiCovering132PaperPublicationPdfBuffer(input);
  const matches = buf.toString("latin1").match(/\/Type\s*\/Page\b/g);
  return matches ? matches.length : 0;
}
