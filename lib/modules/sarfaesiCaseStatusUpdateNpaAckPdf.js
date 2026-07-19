// Module PDF layout — draws printable pages (pdfkit).

// Module-specific file: SARFAESI Case Status Update NPA Acknowledgement only.
// Do not move this logic into generic/shared files.
// Operator guide: README.md#sarfaesi-covering-sheet-pdfs

/**
 * SARFAESI Case Status Update — NPA Acknowledgement PDF.
 *
 * Plain-language intent:
 * - Dual-half A4 sheet for bank seal/signature when NPA hand-delivers notices/documents.
 * - Header: logo + red title + 5-row case fields (Branch…File Maintenance).
 * - Body: Documents Submitted checklist (empty checkboxes) | blank Acknowledgement.
 *
 * API: GET /api/sarfaesi-case-status-update/npa-acknowledgement-pdf/:id
 * UI: Print NPA Acknowledgement (view row / edit toolbar).
 *
 * @module sarfaesiCaseStatusUpdateNpaAckPdf
 */

import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { rowValueForField } from "../gridRowValue";

const COLOR_TITLE_RED = "#C0392B";
const COLOR_ACCENT_BLUE = "#0077B3";
const COLOR_BOX_BORDER = "#222222";
const COLOR_BOX_DIVIDER = "#222222";

const FS_BODY = 9;
const FS_TITLE = 11;
const FS_TABLE = 10;
const FS_CHECK = 8.5;
const FS_COL_HEAD = 10;

const HEADER_ROW_H = 20;
const HEADER_ROWS = 5;
const HALF_TOP_PAD = 12;
const PAGE_MARGIN = 36;
const BOX_LINE_W = 0.75;
const LOGO_W = 280;
const LOGO_H = 48;
const SECTION_GAP = 10;
const DOC_HEADER_H = 20;
const DOC_ROW_H = 16;
const CHECK_SIZE = 9;

export const NPA_ACK_TITLE = "BRANCH ACKNOWLEDGEMENT — SARFAESI NOTICES / DOCUMENTS";

/** Hardcoded Documents Submitted lines (empty checkboxes at print). */
export const NPA_ACK_DOCUMENT_LINES = [
  "13(2) Demand Notice dated ...........................................",
  "13(2) Postal Receipts (Original / Photocopy)",
  "13(2) Postal Acknowledgements ...........................................",
  "13(2) Paper Publication ...........................................",
  "13(4) Possession Notice dated ...........................................",
  "13(4) Postal Receipts (Original / Photocopy)",
  "13(4) Postal Acknowledgements ...........................................",
  "13(4) Paper Publication ...........................................",
  "13(4) Photographs",
  "..............................................................."
];

function pdfSafeLine(s) {
  return String(s ?? "")
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/\u20B9/g, "Rs.");
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

export function safeSarfaesiNpaAckPdfFilename(refHint) {
  const safe =
    String(refHint ?? "")
      .trim()
      .replace(/[^\w./-]+/g, "_")
      .replace(/\//g, "_")
      .slice(0, 120) || "SHEET";
  return `NPA_ACK_${safe}.pdf`;
}

/** Mid-page dashed horizontal guide between the two halves (no label). */
function drawDashedCutGuide(doc, y, left, width) {
  doc.save();
  doc.strokeColor("#888888").lineWidth(0.7).dash(5, { space: 3 });
  doc.moveTo(left, y).lineTo(left + width, y).stroke();
  doc.undash();
  doc.restore();
}

/** 5-row case fields (Branch…File Maintenance) — covering-sheet chrome. */
function drawCaseFieldsHeader(doc, fonts, x, y, w, ctx) {
  const labelW = 100;
  const totalH = HEADER_ROWS * HEADER_ROW_H;
  const pad = 8;

  const branchRight =
    [ctx.branchDisplay, ctx.rboName].filter(Boolean).join(" - ") || ctx.branchDisplay || "";
  const rows = [
    { label: "Branch", value: branchRight },
    { label: "Borrower", value: ctx.borrower || "", valueColor: COLOR_ACCENT_BLUE },
    { label: "Loan AC No", value: ctx.loanAccountNo || "", valueColor: COLOR_ACCENT_BLUE },
    { label: "Loan Type", value: ctx.loanType || "" },
    { label: "File Maintenance", value: ctx.fileMaintenance || "" }
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

function drawEmptyCheckbox(doc, x, y) {
  doc.save();
  doc.lineWidth(BOX_LINE_W).strokeColor(COLOR_BOX_BORDER);
  doc.rect(x, y, CHECK_SIZE, CHECK_SIZE).stroke();
  doc.restore();
}

/**
 * Documents Submitted (left) | Acknowledgement blank (right).
 */
function drawDocsAndAckBlock(doc, fonts, x, y, w, bottomY) {
  const leftW = Math.round(w * 0.58);
  const rightW = w - leftW;
  const rightX = x + leftW;
  const totalH = Math.max(bottomY - y, DOC_HEADER_H + DOC_ROW_H * NPA_ACK_DOCUMENT_LINES.length + 8);

  doc.save();
  doc.lineWidth(BOX_LINE_W).strokeColor(COLOR_BOX_BORDER);
  doc.rect(x, y, w, totalH).stroke();
  doc.moveTo(rightX, y).lineTo(rightX, y + totalH).stroke();
  doc.moveTo(x, y + DOC_HEADER_H).lineTo(x + w, y + DOC_HEADER_H).stroke();
  doc.restore();

  doc.font(fonts.bold).fontSize(FS_COL_HEAD).fillColor("#000000");
  doc.text("Documents Submitted", x + 4, y + 5, {
    width: leftW - 8,
    align: "center",
    lineBreak: false
  });
  doc.text("Acknowledgement", rightX + 4, y + 5, {
    width: rightW - 8,
    align: "center",
    lineBreak: false
  });

  let ly = y + DOC_HEADER_H + 4;
  const textX = x + 8 + CHECK_SIZE + 6;
  const textW = leftW - (textX - x) - 6;

  for (const line of NPA_ACK_DOCUMENT_LINES) {
    if (ly + DOC_ROW_H > y + totalH - 2) break;
    drawEmptyCheckbox(doc, x + 8, ly + 2);
    doc.font(fonts.regular).fontSize(FS_CHECK).fillColor("#000000");
    doc.text(pdfSafeLine(line), textX, ly + 2, {
      width: textW,
      lineBreak: false
    });
    ly += DOC_ROW_H;
  }

  doc.fillColor("#000000");
  return y + totalH;
}

/**
 * One half: logo → title → case fields → docs/ack block.
 */
function drawHalf(doc, fonts, topY, halfH, ctx) {
  const left = PAGE_MARGIN;
  const contentW = doc.page.width - PAGE_MARGIN * 2;
  const halfBottom = topY + halfH - 10;
  let y = topY + HALF_TOP_PAD;

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
  y += LOGO_H + 8;

  doc.font(fonts.bold).fontSize(FS_TITLE).fillColor(COLOR_TITLE_RED);
  doc.text(NPA_ACK_TITLE, left, y, { width: contentW, align: "center", lineBreak: false });
  const titleW = Math.min(doc.widthOfString(NPA_ACK_TITLE), contentW);
  const titleX = left + (contentW - titleW) / 2;
  doc
    .strokeColor(COLOR_TITLE_RED)
    .lineWidth(0.8)
    .moveTo(titleX, y + FS_TITLE + 2)
    .lineTo(titleX + titleW, y + FS_TITLE + 2)
    .stroke();
  doc.fillColor("#000000");
  y += FS_TITLE + 12;

  y = drawCaseFieldsHeader(doc, fonts, left, y, contentW, ctx) + SECTION_GAP;

  drawDocsAndAckBlock(doc, fonts, left, y, contentW, halfBottom);
}

/**
 * @param {object} input
 * @param {object} [input.nciRow]
 * @param {object} [input.branchContext]
 */
export function buildSarfaesiNpaAckPdfBuffer(input) {
  const nci = input?.nciRow || {};
  const bc = input?.branchContext || {};

  const ctx = {
    branchDisplay: pdfSafeLine(bc.branchDisplay || ""),
    rboName: pdfSafeLine(bc.rboName || ""),
    borrower: pdfSafeLine(rowValueForField(nci, "borrower")),
    loanAccountNo: pdfSafeLine(rowValueForField(nci, "loanAccountNo")),
    loanType: pdfSafeLine(
      rowValueForField(nci, "loanTypeLabel") ?? rowValueForField(nci, "loanType")
    ),
    fileMaintenance: pdfSafeLine(
      rowValueForField(nci, "fileMaintenanceLabel") ?? rowValueForField(nci, "fileMaintenance")
    )
  };

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

    drawHalf(doc, fonts, 0, halfH, ctx);
    drawDashedCutGuide(doc, halfH, contentLeft, contentW);
    drawHalf(doc, fonts, halfH, halfH, ctx);

    doc.end();
  });
}

/** @internal Test helper */
export async function countSarfaesiNpaAckPdfPages(input) {
  const buf = await buildSarfaesiNpaAckPdfBuffer(input);
  const matches = buf.toString("latin1").match(/\/Type\s*\/Page\b/g);
  return matches ? matches.length : 0;
}
