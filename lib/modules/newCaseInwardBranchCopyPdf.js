// Module PDF layout — draws printable pages (pdfkit).

// Module-specific file: contains business rules for this module only.
// Do not move this logic into generic/shared files.

import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { getYmdISTFromInstant } from "../istDateTime";
import { rowValueForField } from "../gridRowValue";

/**
 * Branch Copy PDF builder for New Case Inward.
 *
 * Plain-language intent:
 * - Produce a print-friendly branch communication letter (A4), two copies per download.
 * - Keep wording/layout close to approved legacy business format.
 * - Use brand fonts/images when available, otherwise safe built-in fallback.
 */

const COPY_LABELS = ["Branch Copy", "RBO/RO/ZO Copy"];
const COLOR_COPY_GREEN = "#04AA6D";
const FS_COPY = 10;

function todayLongIST() {
  const d = new Date();
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long", timeZone: "Asia/Kolkata" });
  const day = Number(
    d.toLocaleDateString("en-GB", { day: "2-digit", timeZone: "Asia/Kolkata" }).replace(/^0/, "")
  );
  const monthYear = d.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata"
  });
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  return `${weekday}, ${day}${suffix} ${monthYear}`;
}

function formatDmySlash(value) {
  const ymd = String(value ?? "").trim();
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatInr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function safeText(v) {
  return String(v ?? "").replace(/\u20B9/g, "Rs.").trim();
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

function buildBranchCopyContext({
  data,
  bankName = "",
  branchLabel = "",
  place = "",
  rboName = "",
  signatoryName = "",
  bankShortCode = "",
  unitCode = ""
}) {
  const bankCode = safeText(bankShortCode).toUpperCase();
  return {
    caseNo: safeText(rowValueForField(data, "caseNo")),
    borrower: safeText(rowValueForField(data, "borrower")),
    loanAccountNo: safeText(rowValueForField(data, "loanAccountNo")),
    loanType: safeText(
      rowValueForField(data, "loanTypeLabel") ?? rowValueForField(data, "loanType")
    ),
    npaStatus: safeText(
      rowValueForField(data, "npaStatusLabel") ?? rowValueForField(data, "npaStatus")
    ),
    closureBalance: formatInr(rowValueForField(data, "closureBalance")),
    entrustmentDate: formatDmySlash(
      getYmdISTFromInstant(new Date()) ? String(rowValueForField(data, "entrustmentDate")) : ""
    ),
    receivedFrom: safeText(
      rowValueForField(data, "receivedFromLabel") ?? rowValueForField(data, "receivedFrom")
    ),
    signature: safeText(unitCode) !== "Unit 2" ? "M Prasaad" : safeText(signatoryName || " "),
    signatureImageFile: safeText(unitCode) !== "Unit 2" ? "prasaad_sign.png" : "amith_sign.png",
    bankName,
    branchLabel,
    place,
    rboName,
    rboLabel: bankCode === "SBI" ? "RBO" : bankCode === "BOI" ? "HO / ZO" : "RO",
    printDate: todayLongIST()
  };
}

function drawOneCopyPage(doc, fontFace, copyLabel, ctx) {
  const left = doc.page.margins.left;
  const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  let y = doc.page.margins.top;
  const sectionGap = 14;

  const logoPath = path.join(process.cwd(), "public", "images", "npa_full_transparent_bg.png");
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, left, y - 4, { fit: [320, 58], align: "center" });
  }
  y += 60;

  doc.font(fontFace.regular).fontSize(12).fillColor("#000").text(`Date: ${ctx.printDate}`, left, y, {
    width: pageW * 0.55,
    align: "left",
    lineBreak: false
  });
  doc.font(fontFace.bold).fontSize(FS_COPY).fillColor(COLOR_COPY_GREEN).text(copyLabel, left, y, {
    width: pageW,
    align: "right",
    lineBreak: false
  });
  doc.fillColor("#000");
  y += sectionGap * 2;

  const boxLine = (label, value, first = false, last = false) => {
    const rowH = 22;
    doc.rect(left, y, pageW, rowH).lineWidth(0.7).strokeColor("#b8bfd1").stroke();
    if (!first) {
      doc.moveTo(left, y).lineTo(left + pageW, y).strokeColor("#ffffff").stroke();
    }
    if (!last) {
      doc.moveTo(left, y + rowH).lineTo(left + pageW, y + rowH).strokeColor("#d4dae8").stroke();
    }
    doc.font(fontFace.regular).fontSize(11).fillColor("#000").text(`${label}`, left + 8, y + 6);
    doc.text(":", left + 95, y + 6);
    doc.font(fontFace.bold).text(safeText(value), left + 108, y + 6, { width: pageW - 118 });
    y += rowH;
  };

  boxLine("Kind Attn.", "The Chief / Branch Manager", true, false);
  boxLine("Bank", ctx.bankName);
  boxLine("Branch", ctx.branchLabel);
  boxLine("Place", ctx.place);
  boxLine(ctx.rboLabel, ctx.rboName, false, true);

  y += sectionGap;
  doc.font(fontFace.regular)
    .fontSize(11)
    .text(
      `This is to bring to your notice that the following Loan A/C has been assigned to us by ${safeText(
        ctx.receivedFrom || "-"
      )} on ${safeText(ctx.entrustmentDate || "-")}.`,
      left,
      y,
      { width: pageW, lineGap: 2, align: "justify" }
    );
  y = doc.y + sectionGap;

  boxLine("Borrower", ctx.borrower, true, false);
  boxLine("Loan AC No", ctx.loanAccountNo);
  boxLine("Loan Type", ctx.loanType);
  boxLine("NPA Status", ctx.npaStatus);
  boxLine("Closure Balance", ctx.closureBalance, false, true);

  y += sectionGap;
  doc.rect(left, y, pageW, 24).lineWidth(0.7).strokeColor("#d4dae8").stroke();
  doc.font(fontFace.bold).fontSize(13).fillColor("#0b4a9a").text("PLEASE NOTE:", left + 10, y + 6);
  y += 24;

  const notes = [
    "1. From today onward, we will coordinate with the borrower(s) and guarantor(s) and take all required recovery / seizure actions to regularize or close the NPA account at the earliest.",
    "2. As our team is actively following up with the borrower(s) and guarantor(s), we request the branch not to engage with them in parallel.",
    "3. If the borrower(s), guarantor(s), or any concerned person approaches the branch regarding this loan account, kindly inform us immediately.",
    "4. For any clarification related to the above loan account, please contact us and refer to the Case No. mentioned below."
  ];
  doc.font(fontFace.bold).fontSize(10.5).fillColor("#a93d18");
  for (const n of notes) {
    const startY = y;
    doc.text(n, left + 8, y + 6, { width: pageW - 16, lineGap: 2, align: "justify" });
    y = doc.y + 8;
    doc.rect(left, startY, pageW, y - startY).lineWidth(0.7).strokeColor("#d4dae8").stroke();
  }

  y += sectionGap;
  const caseBoxW = 180;
  doc.rect(left, y, caseBoxW, 24).lineWidth(0.8).strokeColor("#8ca3cf").stroke();
  doc.font(fontFace.bold).fontSize(11).fillColor("#000").text("Case No.", left + 8, y + 7, {
    width: caseBoxW - 16,
    align: "center"
  });
  y += 24;
  doc.rect(left, y, caseBoxW, 34).lineWidth(1).strokeColor("#8ca3cf").stroke();
  doc.font(fontFace.bold).fontSize(16).fillColor("#0b9d59").text(ctx.caseNo, left + 8, y + 10, {
    width: caseBoxW - 16,
    align: "center"
  });
  y += 34;

  y = Math.max(doc.y + sectionGap, doc.page.height - 150);
  doc.font(fontFace.bold).fontSize(12).fillColor("#000").text("For NPA Enforcement Squad", left, y);
  y += 12;
  const signatureImagePath = path.join(process.cwd(), "public", "images", ctx.signatureImageFile);
  if (fs.existsSync(signatureImagePath)) {
    doc.image(signatureImagePath, left, y, { fit: [125, 36], align: "left" });
    y += 40;
  } else {
    y += 30;
  }
  doc.font(fontFace.regular).fontSize(12).text(ctx.signature, left, y);
  y += 18;
  doc.font(fontFace.regular).fontSize(12).text("Director", left, y);

  const footerPath = path.join(process.cwd(), "public", "images", "npa_regd_off_footer.png");
  if (fs.existsSync(footerPath)) {
    const footerX = doc.page.margins.left;
    const footerW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const footerImg = doc.openImage(footerPath);
    const scaledH = footerImg?.width ? (footerW * footerImg.height) / footerImg.width : 20;
    const printSafeOffset = 8;
    const footerY = doc.page.height - scaledH - printSafeOffset;
    doc.image(footerPath, footerX, footerY, { width: footerW, align: "left" });
  }
}

export function buildNewCaseInwardBranchCopyPdf({
  data,
  bankName = "",
  branchLabel = "",
  place = "",
  rboName = "",
  signatoryName = "",
  bankShortCode = "",
  unitLabel = "",
  unitCode = ""
}) {
  const ctx = buildBranchCopyContext({
    data,
    bankName,
    branchLabel,
    place,
    rboName,
    signatoryName,
    bankShortCode,
    unitCode
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "A4" });
    const fontFace = registerPreferredSansFonts(doc);
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    COPY_LABELS.forEach((copyLabel, idx) => {
      if (idx > 0) doc.addPage();
      drawOneCopyPage(doc, fontFace, copyLabel, ctx);
    });

    doc.end();
  });
}

/** @internal Test helper — returns page count for a minimal payload. */
export async function countBranchCopyPdfPages(input) {
  const buf = await buildNewCaseInwardBranchCopyPdf(input);
  const matches = buf.toString("latin1").match(/\/Type\s*\/Page\b/g);
  return matches ? matches.length : 0;
}

export function safeBranchCopyPdfFilename(caseNoRaw) {
  const safeCaseNo = String(caseNoRaw ?? "")
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
  return `${safeCaseNo || "CASE"}_BRANCH_COPY.pdf`;
}
