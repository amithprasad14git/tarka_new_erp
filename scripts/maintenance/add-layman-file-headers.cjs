/**
 * One-off helper: prepend layman-friendly file headers where missing.
 * Run: node scripts/maintenance/add-layman-file-headers.cjs
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "../..");
const SKIP_DIRS = new Set(["node_modules", ".next", "coverage", "dist"]);

// Returns true if the file already starts with a documentation comment (// or /**).
function hasDocBlock(content) {
  const trimmed = content.trimStart();
  const withoutClient = trimmed.replace(/^"use client";?\s*\n?/, "");
  // Treat either a block comment or a category // line as an existing header
  // so we never prepend a second generic header on top of a richer one.
  return /^\/\*\*/.test(withoutClient) || /^\/\//.test(withoutClient);
}

// Turns a file path into a short name without folder or extension.
function humanName(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

// Picks the right header text based on which folder the file lives in.
function headerFor(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  const base = humanName(norm);

  if (norm.startsWith("tests/jest/")) {
    const target = norm.replace("tests/jest/", "").replace(".test.js", "");
    return {
      category: "// Test file — automated checks so changes do not break existing behaviour.",
      block: `/**\n * Tests for \`${target}\`.\n * Run with: npm test\n */`
    };
  }
  if (norm.startsWith("app/api/") && norm.endsWith("/route.js")) {
    const route = norm.replace("app", "").replace("/route.js", "");
    return {
      category: "// Application API route — called by the browser or other server code.",
      block: `/**\n * HTTP handler for \`${route}\`.\n * Business rules live in lib/modules; this file loads data and returns JSON or files.\n */`
    };
  }
  if (norm.startsWith("app/")) {
    return {
      category: "// Application page or layout — what users see in the browser.",
      block: `/**\n * Next.js page/layout: ${norm.replace("app/", "")}\n */`
    };
  }
  if (norm.startsWith("components/")) {
    return {
      category: null,
      block: `/**\n * React UI component: ${base}\n * Reusable screen piece used across dashboard modules.\n * Keep module-specific business rules in lib/modules/*Client.js, not here.\n */`
    };
  }
  if (norm.startsWith("lib/modules/") && norm.endsWith("Client.js")) {
    const modKey = base.replace("Client", "");
    return {
      category: "// Module-specific browser helpers — keep out of generic components.",
      block: `/**\n * ${modKey} — browser-only behaviour (forms, pickers, Print/download).\n * Server save rules: lib/modules/${modKey}.js\n */`
    };
  }
  if (norm.startsWith("lib/modules/") && norm.endsWith("Pdf.js")) {
    return {
      category: "// Module PDF layout — draws printable pages (pdfkit).",
      block: `/**\n * ${base} — builds the downloadable PDF for this module.\n * API routes call build*PdfBuffer; operators use Print in the UI.\n */`
    };
  }
  if (norm.startsWith("lib/modules/")) {
    return {
      category: "// Module-specific server rules — validations and side effects on save.",
      block: `/**\n * ${base} — business rules when records are created or updated.\n * Form fields and labels: config/modules.js\n */`
    };
  }
  if (norm.startsWith("lib/services/")) {
    return {
      category: "// Shared service — database operations used by many API routes.",
      block: `/**\n * ${base} — CRUD and related database work for master modules.\n */`
    };
  }
  if (norm.startsWith("lib/")) {
    return {
      category: "// Shared library helper — used across modules (not one screen only).",
      block: `/**\n * ${base} — reusable utility for the ERP (server-side or shared).\n */`
    };
  }
  if (norm.startsWith("config/")) {
    return {
      category: "// Configuration — defines modules, fields, and dashboard layout.",
      block: `/**\n * ${base} — central settings read by the app at startup or on each request.\n */`
    };
  }
  if (norm.startsWith("scripts/")) {
    return null;
  }
  return {
    category: null,
    block: `/**\n * ${norm}\n */`
  };
}

// Adds a layman header at the top of a file when one is missing.
function prependHeader(content, relPath) {
  if (hasDocBlock(content)) return false;
  const h = headerFor(relPath);
  if (!h) return false;

  const trimmed = content.trimStart();
  const useClient = trimmed.startsWith('"use client"');
  const body = useClient ? trimmed.replace(/^"use client";?\s*\n?/, "") : trimmed;

  const parts = [];
  if (useClient) parts.push('"use client";', "");
  if (h.category) parts.push(h.category, "");
  parts.push(h.block, "", body);

  const out = parts.join("\n");
  fs.writeFileSync(path.join(ROOT, relPath), out + (content.endsWith("\n") ? "\n" : ""), "utf8");
  return true;
}

// Recursively scans folders and updates each matching source file.
function walk(dir, rel = "") {
  let updated = 0;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const relPath = rel ? `${rel}/${ent.name}` : ent.name;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      updated += walk(full, relPath);
    } else if (/\.(js|jsx|cjs)$/.test(ent.name) && ent.name !== "add-layman-file-headers.cjs") {
      const content = fs.readFileSync(full, "utf8");
      if (prependHeader(content, relPath.replace(/\\/g, "/"))) {
        console.log("Updated:", relPath);
        updated++;
      }
    }
  }
  return updated;
}

const roots = ["app", "components", "lib", "config", "scripts", "tests"];
let total = 0;
for (const r of roots) {
  const p = path.join(ROOT, r);
  if (fs.existsSync(p)) total += walk(p, r);
}
console.log("Done. Files updated:", total);
