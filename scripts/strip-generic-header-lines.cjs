/**
 * Strips leftover generic one-liner from add-layman-file-headers.cjs when a
 * more specific comment block follows on the next lines.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SKIP_DIRS = new Set(["node_modules", ".next", "coverage", "dist"]);

const STRIP_PREFIXES = [
  "// Shared library helper — used across modules (not one screen only).\n\n",
  "// Module-specific browser helpers — keep out of generic components.\n\n",
  "// Application API route — called by the browser or other server code.\n\n",
  "// Application page or layout — what users see in the browser.\n\n",
  "// Configuration — defines modules, fields, and dashboard layout.\n\n"
];

// Removes a generic one-line header when a better block is below it.
function stripGenericShortBlock(content) {
  let out = content;
  out = out.replace(
    /\/\/ Shared library helper — used across modules[^\n]*\n\n\/\*\*\n \* amountInWords — reusable[\s\S]*?\*\/\n\n(?=\/\/ Indian Rupees)/,
    ""
  );
  out = out.replace(
    /\/\*\*\n \* React UI component:[\s\S]*?\*\/\n\n(?=\/\/ Generic\/shared file)/g,
    ""
  );
  for (const p of STRIP_PREFIXES) {
    if (out.startsWith(p)) {
      const rest = out.slice(p.length);
      if (/^(\/\/|\/\*\*|"use client")/.test(rest.trimStart())) {
        out = rest;
      }
    }
  }
  return out;
}

// Recursively scans folders and updates each matching source file.
function walk(dir, rel = "") {
  let n = 0;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const relPath = rel ? `${rel}/${ent.name}` : ent.name;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) n += walk(full, relPath);
    else if (/\.(js|jsx|cjs)$/.test(ent.name) && !/add-layman|dedupe-layman|strip-generic/.test(ent.name)) {
      const content = fs.readFileSync(full, "utf8");
      const next = stripGenericShortBlock(content);
      if (next !== content) {
        fs.writeFileSync(full, next.endsWith("\n") ? next : next + "\n", "utf8");
        console.log("Cleaned:", relPath);
        n++;
      }
    }
  }
  return n;
}

let total = 0;
for (const r of ["app", "components", "lib", "config", "scripts", "tests"]) {
  const p = path.join(ROOT, r);
  if (fs.existsSync(p)) total += walk(p, r);
}
console.log("Done. Cleaned:", total);
