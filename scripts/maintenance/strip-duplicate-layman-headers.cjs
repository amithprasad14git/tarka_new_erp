/**
 * Removes generic headers prepended by add-layman-file-headers.cjs when a richer
 * original header already followed. Keeps the second (original) documentation block.
 *
 * Run: node scripts/maintenance/strip-duplicate-layman-headers.cjs
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "../..");
const SKIP_DIRS = new Set(["node_modules", ".next", "coverage", "dist"]);

/** Generic first-block patterns the header script inserts. */
const GENERIC_MARKERS = [
  "HTTP handler for `",
  "reusable utility for the ERP (server-side or shared).",
  "Reusable screen piece used across dashboard modules.",
  "Next.js page/layout:",
  "central settings read by the app at startup or on each request.",
  "Run with: npm test",
  "CRUD and related database work for master modules.",
  "business rules when records are created or updated.",
  "browser-only behaviour (forms, pickers, Print/download).",
  "builds the downloadable PDF for this module."
];

/**
 * @param {string} content
 * @returns {string|null} cleaned content, or null if unchanged
 */
function stripDuplicateHeader(content) {
  const useClientMatch = content.match(/^("use client";?\s*\n+)/);
  const prefix = useClientMatch ? useClientMatch[1] : "";
  let body = useClientMatch ? content.slice(prefix.length) : content;

  // Optional leading // category lines, then first /** ... */
  const firstBlock = body.match(/^(?:\/\/[^\n]*\n+)*(?:\/\*\*[\s\S]*?\*\/\s*\n+)/);
  if (!firstBlock) return null;

  const first = firstBlock[0];
  const rest = body.slice(first.length);

  // Second header: more // lines and/or another /** ... */
  const secondStarts = /^(?:\/\/[^\n]*\n+)*(?:\/\*\*|\/\/)/.test(rest);
  if (!secondStarts) return null;

  const isGeneric = GENERIC_MARKERS.some((m) => first.includes(m));
  if (!isGeneric) return null;

  // Prefer keeping rest when it has a richer /** block or category lines
  const restHasDoc = /^(?:\/\/[^\n]*\n+)*\/\*\*/.test(rest) || /^\/\/ /.test(rest);
  if (!restHasDoc) return null;

  return prefix + rest;
}

function walk(dir, rel = "") {
  let updated = 0;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const relPath = rel ? `${rel}/${ent.name}` : ent.name;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      updated += walk(full, relPath);
      continue;
    }
    if (!/\.(js|jsx|cjs)$/.test(ent.name)) continue;
    if (ent.name === "strip-duplicate-layman-headers.cjs") continue;
    if (ent.name === "add-layman-file-headers.cjs") continue;

    const content = fs.readFileSync(full, "utf8");
    const next = stripDuplicateHeader(content);
    if (next != null && next !== content) {
      fs.writeFileSync(full, next.endsWith("\n") ? next : `${next}\n`, "utf8");
      console.log("Stripped:", relPath);
      updated++;
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
console.log("Done. Files stripped:", total);
