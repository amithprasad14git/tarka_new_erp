// Shared report helper — resolve report logo path to filesystem.

/**
 * Maps reportLayout.logoPath (web path) to public/images/... for Excel addImage and HTML img src.
 */

import fs from "fs";
import path from "path";

/**
 * @param {string | undefined} logoPath Web path under public (leading slash optional)
 * @returns {string | null} Absolute filesystem path if the file exists
 */
export function resolveReportLogoFile(logoPath) {
  if (!logoPath || typeof logoPath !== "string") return null;
  const trimmed = logoPath.trim();
  if (!trimmed) return null;
  const relative = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  if (relative.includes("..")) return null;
  const full = path.join(process.cwd(), "public", ...relative.split("/"));
  return fs.existsSync(full) ? full : null;
}

/**
 * @param {string} absolutePath
 * @returns {'png' | 'jpeg' | 'gif'}
 */
export function imageExtensionForExcel(absolutePath) {
  const ext = path.extname(absolutePath).slice(1).toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "jpeg";
  if (ext === "gif") return "gif";
  return "png";
}

