/**
 * Removes shallow duplicate headers when a richer /** block follows within ~400 chars.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "../..");
const SKIP_DIRS = new Set(["node_modules", ".next", "coverage", "dist"]);

// Removes a shallow duplicate comment when a longer one follows right after.
function dedupe(content) {
  let out = content;
  const useClient = out.trimStart().startsWith('"use client"');
  let body = useClient ? out.trimStart().replace(/^"use client";?\s*\n?/, "") : out.trimStart();

  for (let pass = 0; pass < 3; pass++) {
    const idx1 = body.indexOf("/**");
    if (idx1 < 0) break;
    const end1 = body.indexOf("*/", idx1);
    if (end1 < 0) break;
    const end1Full = end1 + 2;
    const block1 = body.slice(idx1, end1Full);
    const after1 = body.slice(end1Full).replace(/^\s*\n+/, "");
    const idx2 = after1.indexOf("/**");
    const slashBefore2 = after1.indexOf("//");
    if (idx2 < 0 || idx2 > 350) break;
    if (slashBefore2 >= 0 && slashBefore2 < idx2 && idx2 - slashBefore2 < 200) {
      // keep // lines before second block as part of "after1"
    }
    const end2 = after1.indexOf("*/", idx2);
    if (end2 < 0) break;
    const block2 = after1.slice(idx2, end2 + 2);
    if (block2.length <= block1.length + 40) break;

    const before1 = body.slice(0, idx1).replace(/\s+$/, "");
    body = (before1 ? before1 + "\n\n" : "") + after1;
  }

  const result = useClient ? `"use client";\n\n${body}` : body;
  return result === content ? content : result;
}

// Recursively scans folders and updates each matching source file.
function walk(dir, rel = "") {
  let n = 0;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const relPath = rel ? `${rel}/${ent.name}` : ent.name;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) n += walk(full, relPath);
    else if (/\.(js|jsx|cjs)$/.test(ent.name) && !/dedupe-layman|add-layman/.test(ent.name)) {
      const content = fs.readFileSync(full, "utf8");
      const next = dedupe(content);
      if (next !== content) {
        fs.writeFileSync(full, next.endsWith("\n") ? next : next + "\n", "utf8");
        console.log("Deduped:", relPath);
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
console.log("Done. Deduped files:", total);
