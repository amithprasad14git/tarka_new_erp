// Module-specific file: contains business rules for this module only.
// Do not move this logic into generic/shared files.

import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { rowValueForField } from "../gridRowValue";

const MM_TO_PT = 2.83465;

function mm(n) {
  return n * MM_TO_PT;
}

function pdfSafeLine(s) {
  return String(s ?? "")
    .replace(/\u20B9/g, "Rs.")
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/\u00A0/g, " ");
}

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

function formatInr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return `${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function maskLoanAccount(no) {
  const s = String(no ?? "").trim();
  if (s.length <= 4) return s;
  return `XXXXXXX${s.slice(-4)}`;
}

const PUBLIC_NOTICE_IMAGE_DIR = path.join(process.cwd(), "public", "images");
const LINE_GAP = 4;

function resolveImageByBasename(basename) {
  const base = String(basename || "").trim();
  if (!base) return null;
  for (const ext of [".png", ".jpg", ".jpeg", ".PNG", ".JPG", ".JPEG"]) {
    const p = path.join(PUBLIC_NOTICE_IMAGE_DIR, `${base}${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
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

function bankLogoFile(bankCodeRaw) {
  const c = String(bankCodeRaw ?? "")
    .trim()
    .toUpperCase();
  const basenames = {
    SBI: "sbi_logo_long",
    CAN: "canara_bank_logo",
    BOB: "bob_logo",
    BOI: "boi_logo"
  };
  const base = basenames[c];
  return base ? resolveImageByBasename(base) : null;
}

export function buildPublicNoticePdfBuffer(input) {
  const nci = input?.nciRow || {};
  const bc = input?.branchContext || {};
  const unitShort = pdfSafeLine(input?.unitShortCode || rowValueForField(nci, "unitLabel") || "");
  const caseNo = pdfSafeLine(rowValueForField(nci, "caseNo"));
  const entrustmentDate = formatDmySlash(rowValueForField(nci, "entrustmentDate"));
  const branchDisplay = pdfSafeLine(bc.branchDisplay || rowValueForField(nci, "branchLabel") || "");
  const rboName = pdfSafeLine(bc.rboName || "");
  const bankCode = String(bc.bankCode ?? "").trim().toUpperCase();
  const loanAccountNo = pdfSafeLine(rowValueForField(nci, "loanAccountNo"));
  const closureBalance = rowValueForField(nci, "closureBalance");

  let rawPersons = Array.isArray(input?.persons) ? input.persons.slice(0, 3) : [];
  if (rawPersons.length === 0) {
    rawPersons = [{ displayName: "", typeText: "", address: "", employeeOf: "" }];
  }

  const colCount = rawPersons.length >= 3 ? 3 : 2;
  const persons = [];
  for (let i = 0; i < colCount; i++) {
    const p = rawPersons[i] || {};
    persons.push({
      displayName: pdfSafeLine(p.displayName || "").toUpperCase(),
      typeText: pdfSafeLine(p.typeText || "").toUpperCase(),
      address: pdfSafeLine(p.address || ""),
      employeeOf: pdfSafeLine(p.employeeOf || "").toUpperCase()
    });
  }

  const closingText =
    colCount >= 3
      ? "Public and the Person concerned to the above DEFAULTER(S) are hereby notified to take necessary precautions while dealing with them & not to deal with their assets in any manner."
      : "Public and the Person concerned to the above DEFAULTER(S) are hereby notified to take necessary precautions while dealing with them & not to deal with their ASSETS in any manner.";

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: mm(10) });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const fonts = registerPreferredSansFonts(doc);
    const ml = doc.page.margins.left;
    const mr = doc.page.margins.right;
    const usableW = doc.page.width - ml - mr;
    const pageBottom = doc.page.height - doc.page.margins.bottom;
    let y = doc.page.margins.top;

    const HEADER_LOGO_MAX_H = mm(26);
    const GAP_AFTER_LOGO = mm(4);
    const logoPath = bankLogoFile(bankCode);
    if (logoPath && fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, ml, y, {
          fit: [usableW, HEADER_LOGO_MAX_H],
          align: "center"
        });
      } catch {
        /* skip */
      }
      y = y + HEADER_LOGO_MAX_H + GAP_AFTER_LOGO;
    } else {
      y += mm(3);
    }

    const half = usableW / 2;
    doc.font(fonts.bold).fontSize(12);
    const row1Top = y;
    const hRbo = doc.heightOfString(rboName || " ", { width: half - 4, lineGap: LINE_GAP });
    const hAnn = doc.heightOfString("Annexure - II", { width: half - 4, align: "right", lineGap: LINE_GAP });
    const row1H = Math.max(hRbo, hAnn, mm(8));
    doc.fillColor("#ff0000").text(rboName || " ", ml + 2, row1Top, { width: half - 4, lineGap: LINE_GAP });
    doc
      .fillColor("#000000")
      .text("Annexure - II", ml + half + 2, row1Top, { width: half - 4, align: "right", lineGap: LINE_GAP });
    y = row1Top + row1H + mm(2);

    const row2Top = y;
    const bText = `Branch: ${branchDisplay || " "}`;
    const dText = `Date: ${entrustmentDate || " "}`;
    const hB = doc.heightOfString(bText, { width: half - 4, lineGap: LINE_GAP });
    const hD = doc.heightOfString(dText, { width: half - 4, align: "right", lineGap: LINE_GAP });
    const row2H = Math.max(hB, hD, mm(8));
    doc.fillColor("#000000");
    doc.text(bText, ml + 2, row2Top, { width: half - 4, lineGap: LINE_GAP });
    doc.text(dText, ml + half + 2, row2Top, { width: half - 4, align: "right", lineGap: LINE_GAP });
    y = row2Top + row2H + mm(4);

    const titlePng = resolveImageByBasename("public_notice");
    if (titlePng) {
      try {
        const titleW = mm(60);
        const titleH = mm(10);
        const tx = ml + (usableW - titleW) / 2;
        doc.image(titlePng, tx, y, { width: titleW, height: titleH });
        y += titleH + mm(4);
      } catch {
        y += mm(2);
      }
    } else {
      doc.font(fonts.bold).fontSize(14).fillColor("#000000").text("PUBLIC NOTICE", ml, y, {
        width: usableW,
        align: "center"
      });
      y = doc.y + mm(4);
    }

    const bodyIntro =
      "General Public are hereby informed that, after Bank's repeated requests / Notices / Phone Calls / Personal Visits, the under noted Person(s) have not repaid the Loan Amount. These person(s) have DEFAULTED in repayment of their Loan Amount. Hence they have been declared as DEFAULTER(S) of our Bank in accordance with the guidelines issued by the Reserve Bank of India and our Bank's recovery policy. LEGAL steps are being taken to initiate against them.";

    const caseLine = `Case No: ${caseNo || " "} (${unitShort || " "})`;
    doc.font(fonts.bold).fontSize(12);
    const closingBlockH = doc.heightOfString(closingText, {
      width: usableW,
      align: "justify",
      lineGap: LINE_GAP
    });
    doc.font(fonts.bold).fontSize(15);
    const caseBlockH = doc.heightOfString(caseLine, { width: usableW, align: "right", lineGap: LINE_GAP });
    const tailAfterAddr =
      mm(4) + mm(8) * 3 + mm(3) + mm(3) + closingBlockH + caseBlockH + mm(3);

    const colW = usableW / colCount;
    const boxW = mm(35);
    const boxH = colCount >= 3 ? mm(34) : mm(38);
    const headerRowH = mm(5);
    const typeRowH = mm(5);
    const nameRowH = colCount >= 3 ? mm(7) : mm(9);
    const gapAfterIntro = mm(4);
    const gapAfterBoxes = mm(3);

    let introFs = 12;
    while (introFs >= 8) {
      doc.font(fonts.bold).fontSize(introFs).fillColor("#000000");
      const introH = doc.heightOfString(bodyIntro, { width: usableW, align: "justify", lineGap: LINE_GAP });
      const yAfterIntro = y + introH + gapAfterIntro;
      const yAddrStart = yAfterIntro + boxH + gapAfterBoxes + headerRowH + typeRowH + nameRowH;
      const minAddr = mm(8);
      if (yAddrStart + minAddr + tailAfterAddr <= pageBottom) break;
      if (introFs === 8) break;
      introFs -= 1;
    }
    const introMaxH = Math.max(
      mm(16),
      pageBottom -
        y -
        gapAfterIntro -
        boxH -
        gapAfterBoxes -
        headerRowH -
        typeRowH -
        nameRowH -
        mm(8) -
        tailAfterAddr
    );
    doc.font(fonts.bold).fontSize(introFs).fillColor("#000000");
    doc.text(bodyIntro, ml, y, {
      width: usableW,
      align: "justify",
      lineGap: LINE_GAP,
      height: introMaxH,
      ellipsis: true
    });
    y = doc.y + gapAfterIntro;
    const boxGap = (usableW - colCount * boxW) / (colCount + 1);
    let boxX = ml + boxGap;
    const boxY = y;
    const pictureBoxPath = resolveImageByBasename("public_notice_picture_box");
    for (let c = 0; c < colCount; c++) {
      if (pictureBoxPath) {
        try {
          doc.image(pictureBoxPath, boxX, boxY, { width: boxW, height: boxH });
        } catch {
          /* skip */
        }
      }
      boxX += boxW + boxGap;
    }
    y = boxY + boxH + gapAfterBoxes;

    const headerH = headerRowH;
    doc.font(fonts.bold).fontSize(10).fillColor("#000000");
    for (let c = 0; c < colCount; c++) {
      const x = ml + c * colW;
      doc.rect(x, y, colW, headerH).stroke();
      doc.text("Name & Address of", x + 2, y + 1, { width: colW - 4, align: "center", lineGap: LINE_GAP });
    }
    y += headerH;

    const typeH = typeRowH;
    doc.font(fonts.bold).fontSize(10).fillColor("#ff0000");
    for (let c = 0; c < colCount; c++) {
      const x = ml + c * colW;
      doc.rect(x, y, colW, typeH).stroke();
      doc.text(persons[c].typeText || " ", x + 2, y + 1, { width: colW - 4, align: "center", lineGap: LINE_GAP });
    }
    y += typeH;

    const nameH = nameRowH;
    doc.font(fonts.bold).fontSize(colCount >= 3 ? 12 : 15).fillColor("#000000");
    for (let c = 0; c < colCount; c++) {
      const x = ml + c * colW;
      doc.rect(x, y, colW, nameH).stroke();
      doc.text(persons[c].displayName || " ", x + 4, y + 2, { width: colW - 8, align: "left", lineGap: LINE_GAP });
    }
    y += nameH;

    const addrPad = 4;
    const addrY = y;
    const addrSpaceMax = Math.max(mm(8), pageBottom - addrY - tailAfterAddr);

    let addrFontSize = colCount >= 3 ? 10 : 12;
    let addrWidths = [];
    let maxAddrH = 0;
    for (;;) {
      doc.font(fonts.bold).fontSize(addrFontSize).fillColor("#000000");
      addrWidths = [];
      maxAddrH = 0;
      for (let c = 0; c < colCount; c++) {
        const innerW = colW - addrPad * 2;
        const h = doc.heightOfString(persons[c].address || " ", {
          width: innerW,
          align: "left",
          lineGap: LINE_GAP
        });
        addrWidths.push(innerW);
        maxAddrH = Math.max(maxAddrH, h, mm(8));
      }
      if (maxAddrH <= addrSpaceMax || addrFontSize <= 7) break;
      addrFontSize -= 1;
    }
    maxAddrH = Math.min(maxAddrH, addrSpaceMax);

    for (let c = 0; c < colCount; c++) {
      const x = ml + c * colW;
      doc.rect(x, addrY, colW, maxAddrH).stroke();
    }
    for (let c = 0; c < colCount; c++) {
      const x = ml + c * colW;
      doc.text(persons[c].address || " ", x + addrPad, addrY + 2, {
        width: addrWidths[c],
        align: "left",
        lineGap: LINE_GAP,
        height: maxAddrH - 2,
        ellipsis: true
      });
    }
    doc.y = addrY + maxAddrH;
    y = addrY + maxAddrH + mm(4);

    const loanLabelW = mm(50);
    const loanValW = usableW - loanLabelW;
    doc.font(fonts.bold).fontSize(15).fillColor("#0066cc");
    doc.rect(ml, y, loanLabelW, mm(8)).stroke();
    doc.text("LOAN A/C NO", ml + 2, y + 2, { width: loanLabelW - 4, align: "center", lineGap: LINE_GAP });
    doc.fillColor("#009933");
    doc.rect(ml + loanLabelW, y, loanValW, mm(8)).stroke();
    doc.text(maskLoanAccount(loanAccountNo), ml + loanLabelW + 4, y + 2, {
      width: loanValW - 8,
      align: "left",
      lineGap: LINE_GAP,
      height: mm(5),
      ellipsis: true
    });
    y += mm(8);

    doc.font(fonts.bold).fontSize(15).fillColor("#0066cc");
    doc.rect(ml, y, loanLabelW, mm(8)).stroke();
    doc.text("LOAN LIABILITY", ml + 2, y + 2, { width: loanLabelW - 4, align: "center", lineGap: LINE_GAP });
    doc.fillColor("#ff0000");
    doc.rect(ml + loanLabelW, y, loanValW, mm(8)).stroke();
    doc.text(`Rs. ${formatInr(closureBalance)}`, ml + loanLabelW + 4, y + 2, {
      width: loanValW - 8,
      align: "left",
      lineGap: LINE_GAP,
      height: mm(5),
      ellipsis: true
    });
    y += mm(8);

    doc.font(fonts.bold).fontSize(10).fillColor("#000000");
    doc.rect(ml, y, loanLabelW, mm(8)).stroke();
    doc.rect(ml + loanLabelW, y, loanValW, mm(8)).stroke();
    doc.text(
      "+ Interest + Legal + Investigation + Recovery + Other Charges",
      ml + loanLabelW + 4,
      y + 2,
      {
        width: loanValW - 8,
        align: "left",
        lineGap: LINE_GAP,
        height: mm(5),
        ellipsis: true
      }
    );
    y += mm(8) + mm(2);

    const closingY = y;
    const caseReserve = caseBlockH + mm(3);
    let closingFs = 12;
    let closingDrawH = closingBlockH;
    while (closingFs >= 8) {
      doc.font(fonts.bold).fontSize(closingFs).fillColor("#000000");
      closingDrawH = doc.heightOfString(closingText, {
        width: usableW,
        align: "justify",
        lineGap: LINE_GAP
      });
      if (closingY + closingDrawH + caseReserve <= pageBottom) break;
      if (closingFs === 8) break;
      closingFs -= 1;
    }
    doc.font(fonts.bold).fontSize(closingFs).fillColor("#000000");
    const closingAvailH = pageBottom - closingY - caseReserve;
    const closingNaturalFits = closingY + closingDrawH + caseReserve <= pageBottom;
    doc.text(closingText, ml, closingY, {
      width: usableW,
      align: "justify",
      lineGap: LINE_GAP,
      height: closingNaturalFits ? closingDrawH + mm(1) : Math.max(mm(8), closingAvailH),
      ellipsis: !closingNaturalFits
    });
    y = doc.y + mm(2);

    doc.font(fonts.bold).fontSize(15).fillColor("#ff0000");
    doc.text(caseLine, ml, y, {
      width: usableW,
      align: "right",
      lineGap: LINE_GAP,
      height: Math.max(mm(10), pageBottom - y - mm(1)),
      ellipsis: true
    });

    doc.end();
  });
}

export function safePublicNoticePdfFilename(caseNoRaw) {
  const s = String(caseNoRaw ?? "")
    .trim()
    .replace(/\//g, "_")
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 120);
  return s ? `PUBLIC_NOTICE_${s}.pdf` : "PUBLIC_NOTICE.pdf";
}
