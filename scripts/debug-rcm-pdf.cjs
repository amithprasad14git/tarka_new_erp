/**
 * Debug RCM note in Recovery Invoice PDF (raw buffer + fitRcmFontSize).
 * Run from repo root: node scripts/debug-rcm-pdf.cjs
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const babel = require("@babel/core");
const PDFDocument = require("pdfkit");

const ROOT = path.join(__dirname, "..");
process.chdir(ROOT);

const cache = new Map();
function makeRequire(fromFile) {
  return function req(spec) {
    if (!spec.startsWith(".")) return require(spec);
    let resolved = path.resolve(path.dirname(fromFile), spec);
    if (!resolved.endsWith(".js")) resolved += ".js";
    return babelRequire(resolved);
  };
}

function babelRequire(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const src = fs.readFileSync(file, "utf8");
  const { code } = babel.transformSync(src, {
    filename: file,
    presets: [["@babel/preset-env", { targets: { node: "current" } }]],
  });
  const mod = { exports: {} };
  cache.set(file, mod);
  const fn = new Function("exports", "require", "module", "__filename", "__dirname", code);
  fn(mod.exports, makeRequire(file), mod, file, path.dirname(file));
  return mod.exports;
}

const minimalPayload = {
  invoice: { date: "2026-05-16", invoiceNo: "INV/2627/0008" },
  charges: [{ percentage: 5, amount: 5000 }],
  nciRow: {
    borrower: "Test Borrower",
    loanAccountNo: "1234567890",
    loanTypeLabel: "Education Loan",
    npaDate: "2026-01-01",
    caseStatusLabel: "Under Progress",
    caseNo: "B/CF/10003",
  },
  amountRecoveredRows: [{ recoveredDate: "2026-05-01", recoveredAmount: 305690 }],
  branchContext: {
    bankName: "State Bank of India",
    branchDisplay: "Mandya (040001)",
    branchPlace: "Mandya",
    rboName: "RBO Mysore",
    bankCode: "SBI",
  },
  unitShortCode: "Unit 1",
  currentAccount: {
    accountName: "NPA Enforcement & Recovery Squad (P) Ltd.",
    bankName: "State Bank of India",
    branch: "SBI Siddartha Layout",
    accountNo: "40020692454",
    ifscCode: "SBIN0016501",
    gstNo: "29AAHCN2327CGST",
    bankCode: "SBI",
  },
};

const RCM_NOTE =
  "Whether tax is payable under Reverse Charge (RCM): Yes\n\n" +
  "This Invoice does not include GST, since Banks/Financial Institutions are required to pay taxes under Reverse Charges (RCM) as per the Notification No. 13/2017 of Central Tax (Rate) dated 28/06/2017.";

const MM_TO_PT = 2.83465;
const mm = (n) => n * MM_TO_PT;
const FS_BODY = 9;
const FS_RCM_FLOOR = 4;
const BOX_ROW_H = 17;
const CELL_PAD_W = 7;
const CELL_PAD_H = 3;
const LINE_GAP = -1;
const effectiveLineGap = (multiline = false) => (multiline ? Math.max(LINE_GAP, 0) : LINE_GAP);

function pdfSafeLine(s) {
  return String(s ?? "")
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/\u00A0/g, " ");
}

function registerFonts(doc) {
  const regularPath = path.join(ROOT, "public", "fonts", "SamsungSharpSans-Regular.ttf");
  const boldPath = path.join(ROOT, "public", "fonts", "SamsungSharpSans-Bold.ttf");
  if (fs.existsSync(regularPath) && fs.existsSync(boldPath)) {
    doc.registerFont("BrandSans", regularPath);
    doc.registerFont("BrandSans-Bold", boldPath);
    return { regular: "BrandSans", bold: "BrandSans-Bold", source: "SamsungSharpSans" };
  }
  return { regular: "Helvetica", bold: "Helvetica-Bold", source: "Helvetica fallback" };
}

function fitRcmFontSize(doc, fonts, w, h) {
  const innerW = Math.max(1, w - CELL_PAD_W * 2);
  const innerH = Math.max(1, h - CELL_PAD_H * 2);
  const lineGap = effectiveLineGap(true);
  const safe = pdfSafeLine(RCM_NOTE);
  const maxH = innerH - 1;
  const rows = [];
  for (let fs = FS_BODY; fs >= FS_RCM_FLOOR; fs -= 0.5) {
    doc.font(fonts.regular).fontSize(fs);
    const textH = doc.heightOfString(safe, { width: innerW, lineGap });
    const fits = textH <= maxH;
    rows.push({ fs, textH, maxH, fits });
    if (fits) return { chosen: fs, rows, innerW, innerH, maxH };
  }
  return { chosen: FS_RCM_FLOOR, rows, innerW, innerH, maxH };
}

function extractDecompressedPdfText(buf) {
  const raw = buf.toString("latin1");
  const parts = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m;
  while ((m = re.exec(raw))) {
    const chunk = Buffer.from(m[1], "latin1");
    try {
      parts.push(zlib.inflateSync(chunk).toString("latin1"));
    } catch {
      parts.push(chunk.toString("latin1"));
    }
  }
  return parts.join("\n");
}

function searchNeedles(haystack, needles) {
  const out = {};
  for (const n of needles) {
    out[n] = haystack.includes(n);
  }
  return out;
}

async function main() {
  const { buildRecoveryInvoicePdfBuffer } = babelRequire(path.join(ROOT, "lib/modules/recoveryInvoicePdf.js"));

  const buf = await buildRecoveryInvoicePdfBuffer(minimalPayload);
  const outPath = path.join(ROOT, "scripts", "rcm-test-out.pdf");
  fs.writeFileSync(outPath, buf);

  const needles = ["dated", "28/06/2017", "Central Tax", "Reverse Charge", "Notification"];
  const rawLatin = buf.toString("latin1");
  const inRaw = searchNeedles(rawLatin, needles);

  const decompressed = extractDecompressedPdfText(buf);
  const inStreams = searchNeedles(decompressed, needles);

  const contentW = mm(190);
  const accountW = mm(140);
  const rcmW = contentW - accountW;
  const blockHeight = 5 * BOX_ROW_H;

  const measureDoc = new PDFDocument({ size: "A4", margin: 0 });
  const fonts = registerFonts(measureDoc);
  const fit = fitRcmFontSize(measureDoc, fonts, rcmW, blockHeight);

  console.log("=== PDF output ===");
  console.log("Wrote:", outPath);
  console.log("Size bytes:", buf.length);

  console.log("\n=== String search (raw latin1 buffer) ===");
  for (const [k, v] of Object.entries(inRaw)) console.log(`  ${k}: ${v ? "FOUND" : "NOT FOUND"}`);

  console.log("\n=== String search (decompressed PDF streams) ===");
  for (const [k, v] of Object.entries(inStreams)) console.log(`  ${k}: ${v ? "FOUND" : "NOT FOUND"}`);

  console.log("\n=== fitRcmFontSize (SamsungSharpSans) ===");
  console.log("Font:", fonts.source);
  console.log("RCM box w x h (pt):", rcmW.toFixed(2), "x", blockHeight);
  console.log("innerW x innerH / maxH:", fit.innerW.toFixed(2), fit.innerH, fit.maxH);
  console.log("Chosen font size:", fit.chosen);
  console.log("Scan (fs -> textH, fits):");
  for (const r of fit.rows) {
    console.log(`  ${r.fs.toFixed(1)}pt  height=${r.textH.toFixed(2)}  ${r.fits ? "FITS" : "overflow"}`);
  }

  const snippetIdx = decompressed.indexOf("Central Tax");
  if (snippetIdx >= 0) {
    console.log("\n=== Decompressed snippet around 'Central Tax' ===");
    console.log(decompressed.slice(Math.max(0, snippetIdx - 40), snippetIdx + 120).replace(/\n/g, "\\n"));
  } else if (decompressed.indexOf("dated") >= 0) {
    const i = decompressed.indexOf("dated");
    console.log("\n=== Decompressed snippet around 'dated' ===");
    console.log(decompressed.slice(Math.max(0, i - 40), i + 80).replace(/\n/g, "\\n"));
  }

  console.log("\n=== Assessment ===");
  const fullDateInStreams = inStreams["28/06/2017"];
  const fullDateInRaw = inRaw["28/06/2017"];
  console.log(
    "RCM source string includes full date; PDF streams contain date:",
    fullDateInStreams ? "yes" : "no"
  );
  console.log(
    "Jest toContain on raw buffer would:",
    fullDateInRaw ? "pass for date" : "FAIL for date (likely FlateDecode / hex strings in PDF)"
  );
  const bestFit = fit.rows.find((r) => r.fits);
  console.log(
    "Largest fitting font:",
    bestFit ? `${bestFit.fs}pt` : "none down to floor — text may clip when drawn"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
