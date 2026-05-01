// Module-specific file: contains business rules for this module only.
// Do not move this logic into generic/shared files.

import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { modules } from "../../config/modules";
import { REOPEN_ALLOWED_FINAL_CASE_STATUS_SET, normalizeNciCaseStatusLabel } from "./newCaseInwardCaseStatus";
import { rowValueForField } from "../gridRowValue";
import { getYmdISTFromInstant } from "../istDateTime";
import { getLookupRowLabelKey } from "../lookupLabelField";

function printedOnDmyIST() {
  const ymd = getYmdISTFromInstant(new Date());
  if (!ymd) return "";
  const [y, mo, d] = ymd.split("-");
  return `${d}-${mo}-${y}`;
}

function pdfSafeLine(s) {
  return String(s ?? "")
    .replace(/\u20B9/g, "Rs.")
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/\u00A0/g, " ");
}

function formatDateDmy(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const d = String(value.getDate()).padStart(2, "0");
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const y = String(value.getFullYear());
    return `${d}-${m}-${y}`;
  }
  const s = String(value).trim();
  if (!s) return "";
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[3]}-${ymd[2]}-${ymd[1]}`;
  const dmy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmy) return `${dmy[1]}-${dmy[2]}-${dmy[3]}`;
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, "0");
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const y = String(parsed.getFullYear());
    return `${d}-${m}-${y}`;
  }
  return s;
}

function formatInrAmount(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return v == null || v === "" ? "" : pdfSafeLine(String(v));
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function findField(moduleConfig, name) {
  return (moduleConfig?.fields || []).find((f) => f.name === name) || null;
}

function lookupOrRaw(row, field) {
  if (!field) return "";
  const raw = rowValueForField(row, field.name);
  if (field.type === "lookup" && field.lookup) {
    const label =
      rowValueForField(row, getLookupRowLabelKey(field)) ?? rowValueForField(row, field.name);
    return pdfSafeLine(String(label ?? "").trim());
  }
  return pdfSafeLine(String(raw ?? "").trim());
}

function resolvePdfFontFace(doc) {
  const regularPath = path.join(process.cwd(), "public", "fonts", "SamsungSharpSans-Regular.ttf");
  const boldPath = path.join(process.cwd(), "public", "fonts", "SamsungSharpSans-Bold.ttf");
  if (fs.existsSync(regularPath) && fs.existsSync(boldPath)) {
    doc.registerFont("BrandSans", regularPath);
    doc.registerFont("BrandSans-Bold", boldPath);
    return { regular: "BrandSans", bold: "BrandSans-Bold" };
  }
  return { regular: "Helvetica", bold: "Helvetica-Bold" };
}

function font(doc, fontFace, bold = false) {
  doc.font(bold ? fontFace.bold : fontFace.regular);
}

function drawStatusMark(doc, caseStatus, x, y, w, h) {
  const v = normalizeNciCaseStatusLabel(caseStatus);
  const cx = x + w / 2;
  const cy = y + h / 2;

  if (v === normalizeNciCaseStatusLabel("Returned")) {
    const pad = Math.min(w, h) * 0.22;
    doc.save();
    doc.lineWidth(8).lineCap("round").strokeColor("#ff0000");
    doc.moveTo(x + pad, y + pad).lineTo(x + w - pad, y + h - pad).stroke();
    doc.moveTo(x + w - pad, y + pad).lineTo(x + pad, y + h - pad).stroke();
    doc.restore();
    return;
  }

  if (REOPEN_ALLOWED_FINAL_CASE_STATUS_SET.has(v)) {
    doc.save();
    doc.lineWidth(8).lineCap("round").lineJoin("round").strokeColor("#22c55e");
    doc.moveTo(x + w * 0.18, y + h * 0.56).lineTo(x + w * 0.42, y + h * 0.78).stroke();
    doc.moveTo(x + w * 0.42, y + h * 0.78).lineTo(x + w * 0.82, y + h * 0.24).stroke();
    doc.restore();
    return;
  }

  doc.save();
  doc.fillColor("#f59e0b");
  const dots = 8;
  const radius = Math.min(w, h) * 0.28;
  const dotR = Math.max(3, Math.min(w, h) * 0.06);
  for (let i = 0; i < dots; i += 1) {
    const a = (Math.PI * 2 * i) / dots;
    const dx = cx + radius * Math.cos(a);
    const dy = cy + radius * Math.sin(a);
    doc.circle(dx, dy, dotR).fill();
  }
  doc.restore();
}

export function buildNewCaseInwardCaseDetailsPdf({
  data,
  childTableRows = {},
  bankName = "",
  rboName = ""
}) {
  const moduleConfig = modules.new_case_inward;
  const amountRecoveredCfg = (moduleConfig?.childTables || []).find(
    (ct) => (ct.key || ct.table) === "amount_recovered"
  );
  const amountRows = childTableRows?.[amountRecoveredCfg?.key || "amount_recovered"] || [];

  const caseNo = String(rowValueForField(data, "caseNo") ?? "").trim();
  const unit = lookupOrRaw(data, findField(moduleConfig, "unit"));
  const branch = lookupOrRaw(data, findField(moduleConfig, "branch"));
  const caseStatus = lookupOrRaw(data, findField(moduleConfig, "caseStatus"));
  const caseStatusRemarks = String(rowValueForField(data, "caseStatusRemarks") ?? "").trim();
  const modifiedDate = formatDateDmy(rowValueForField(data, "modifiedDate"));
  const createdBy = lookupOrRaw(data, findField(moduleConfig, "createdBy"));
  const borrower = String(rowValueForField(data, "borrower") ?? "").trim();
  const entrustmentDate = formatDateDmy(rowValueForField(data, "entrustmentDate"));
  const loanAccountNo = String(rowValueForField(data, "loanAccountNo") ?? "").trim();
  const loanCategory = lookupOrRaw(data, findField(moduleConfig, "loanCategory"));
  const loanType = lookupOrRaw(data, findField(moduleConfig, "loanType"));
  const npaDate = formatDateDmy(rowValueForField(data, "npaDate"));
  const npaStatus = lookupOrRaw(data, findField(moduleConfig, "npaStatus"));
  const closureBalance = formatInrAmount(rowValueForField(data, "closureBalance"));
  const branchDisplay = bankName ? `${pdfSafeLine(bankName)} - ${branch}` : branch;

  const recoveredTotal = amountRows.reduce((sum, r) => {
    const n = Number(rowValueForField(r, "recoveredAmount"));
    return Number.isFinite(n) ? sum + n : sum;
  }, 0);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: "A4" });
    const fontFace = resolvePdfFontFace(doc);
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const top = doc.page.margins.top;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    const logoPath = path.join(process.cwd(), "public", "images", "npa_without_addr.png");
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, left, top, { fit: [380, 80], align: "left" });
    }

    font(doc, fontFace, true);
    doc.fillColor("#008080").fontSize(18).text("CASE DETAILS", left, top + 70, { width, align: "center" });

    font(doc, fontFace, true);
    doc.fillColor("#004d99").fontSize(14).text(`Case No: ${pdfSafeLine(caseNo || "-")}`, left, top + 100);
    doc.fillColor("#000000").fontSize(12).text(pdfSafeLine(String(unit || "").toUpperCase()), left, top + 100, {
      width,
      align: "right"
    });

    let y = top + 125;
    const labelW = 155;
    const valueW = width - labelW;
    const rowH = 24;

    function drawHeaderRow(label, value, valueColor = "#000000") {
      doc.rect(left, y, labelW, rowH).strokeColor("#334155").lineWidth(0.7).stroke();
      doc.rect(left + labelW, y, valueW, rowH).stroke();
      font(doc, fontFace, false);
      doc.fillColor("#000000").fontSize(9).text(` ${pdfSafeLine(label)}`, left + 2, y + 7);
      font(doc, fontFace, true);
      doc.fillColor(valueColor).fontSize(11).text(` ${pdfSafeLine(value || "-")}`, left + labelW + 2, y + 6, {
        width: valueW - 6
      });
      y += rowH;
    }

    drawHeaderRow("BANK & BRANCH", branchDisplay, "#004d99");
    drawHeaderRow("RBO", rboName, "#004d99");
    drawHeaderRow("ENTRUSTMENT DATE", entrustmentDate, "#000000");
    drawHeaderRow("BORROWER", borrower, "#000000");
    drawHeaderRow("LOAN AC NO", loanAccountNo, "#ff0000");
    drawHeaderRow("LOAN CATEGORY", loanCategory, "#004d99");
    drawHeaderRow("LOAN TYPE", loanType, "#004d99");
    drawHeaderRow("NPA DATE", npaDate, "#000000");
    drawHeaderRow("NPA STATUS", npaStatus, "#ff0000");
    drawHeaderRow("CLOSURE BALANCE", closureBalance, "#ff0000");
    drawHeaderRow("CREATED BY", createdBy, "#04aa6d");

    y += 16;

    const blockTop = y;
    const blockH = 120;
    const col1W = labelW;
    const col3W = 130;
    const col2W = width - col1W - col3W;
    const c1 = left;
    const c2 = c1 + col1W;
    const c3 = c2 + col2W;

    doc.rect(left, blockTop, width, blockH).strokeColor("#334155").lineWidth(0.7).stroke();
    doc.moveTo(c2, blockTop).lineTo(c2, blockTop + blockH).stroke();
    doc.moveTo(c3, blockTop).lineTo(c3, blockTop + blockH).stroke();
    doc.moveTo(left, blockTop + 24).lineTo(left + width, blockTop + 24).stroke();

    font(doc, fontFace, true);
    doc.fillColor("#000000").fontSize(9).text("MODIFIED DATE", c1 + 6, blockTop + 8, {
      width: col1W - 12,
      align: "center"
    });
    doc.text("CASE STATUS REMARKS", c2 + 6, blockTop + 8, {
      width: col2W - 12,
      align: "center"
    });
    doc.text("CASE STATUS", c3 + 6, blockTop + 8, {
      width: col3W - 12,
      align: "center"
    });

    font(doc, fontFace, false);
    doc.fillColor("#000000").fontSize(10).text(pdfSafeLine(modifiedDate || "-"), c1 + 6, blockTop + 32, {
      width: col1W - 12,
      align: "center"
    });
    doc.text(pdfSafeLine(caseStatusRemarks || "-"), c2 + 6, blockTop + 32, {
      width: col2W - 12,
      lineGap: 3,
      height: blockH - 36
    });
    font(doc, fontFace, true);
    doc.fillColor("#ff0000").fontSize(11).text(pdfSafeLine(caseStatus || "-"), c3 + 6, blockTop + 32, {
      width: col3W - 12,
      align: "center"
    });
    const markW = Math.min(72, col3W - 24);
    const markH = 50;
    const markX = c3 + (col3W - markW) / 2;
    const markY = blockTop + 56;
    drawStatusMark(doc, caseStatus, markX, markY, markW, markH);

    let recY = blockTop + blockH + 16;
    const dW = 120;
    const aW = 170;
    const cW = 80;
    const rH = 22;
    const recLeft = left;

    font(doc, fontFace, true);
    doc.fillColor("#000000").fontSize(9);
    doc.rect(recLeft, recY, dW, rH).strokeColor("#334155").lineWidth(0.7).stroke();
    doc.rect(recLeft + dW, recY, aW, rH).stroke();
    doc.rect(recLeft + dW + aW, recY, cW, rH).stroke();
    doc.text("RECOVERED DATE", recLeft + 2, recY + 7, { width: dW - 4, align: "center" });
    doc.text("RECOVERED AMOUNT", recLeft + dW + 2, recY + 7, { width: aW - 4, align: "center" });
    doc.text("CHECKED", recLeft + dW + aW + 2, recY + 7, { width: cW - 4, align: "center" });
    recY += rH;

    for (const row of amountRows) {
      doc.rect(recLeft, recY, dW, rH).stroke();
      doc.rect(recLeft + dW, recY, aW, rH).stroke();
      doc.rect(recLeft + dW + aW, recY, cW, rH).stroke();

      font(doc, fontFace, false);
      doc.fillColor("#000000").fontSize(10).text(formatDateDmy(rowValueForField(row, "recoveredDate")) || "-", recLeft + 4, recY + 6, {
        width: dW - 8,
        align: "center"
      });
      font(doc, fontFace, true);
      doc.fillColor("#004d99").fontSize(11).text(`${formatInrAmount(rowValueForField(row, "recoveredAmount"))} `, recLeft + dW + 4, recY + 6, {
        width: aW - 8,
        align: "right"
      });
      recY += rH;
    }

    doc.rect(recLeft, recY, dW, rH).stroke();
    doc.rect(recLeft + dW, recY, aW, rH).stroke();
    doc.rect(recLeft + dW + aW, recY, cW, rH).stroke();
    font(doc, fontFace, true);
    doc.fillColor("#ff0000").fontSize(11).text("TOTAL", recLeft + 2, recY + 7, { width: dW - 4, align: "center" });
    doc.text(`${formatInrAmount(recoveredTotal)} `, recLeft + dW + 4, recY + 7, {
      width: aW - 8,
      align: "right"
    });
    recY += rH;

    font(doc, fontFace, true);
    doc.fillColor("#000000").fontSize(10).text(`Printed On: ${printedOnDmyIST()}`, left, recY + 64, {
      width,
      align: "left"
    });

    doc.end();
  });
}

export function safeCaseDetailsPdfFilename(caseNoRaw) {
  const s = String(caseNoRaw ?? "")
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
  return s || "case";
}
