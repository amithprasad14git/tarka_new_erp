/**
 * Client-side fetch error formatting — layman text + optional server hint.
 */

import { apiUserMessage } from "./apiUserMessages";

const SESSION_AUTH_MESSAGES = new Set([
  apiUserMessage("sessionExpired"),
  apiUserMessage("sessionInactive"),
  apiUserMessage("sessionReplaced")
]);

/**
 * @param {unknown} err
 * @returns {boolean}
 */
export function isNetworkFetchError(err) {
  if (!err || typeof err !== "object") return false;
  const name = String(err.name || "");
  const msg = String(err.message || "").toLowerCase();
  if (name === "TypeError" && msg.includes("failed to fetch")) return true;
  if (msg.includes("networkerror") || msg.includes("network request failed")) return true;
  if (msg.includes("load failed")) return true;
  return false;
}

/**
 * @param {string} text
 */
export function isUnauthorizedMessage(text) {
  const normalized = String(text || "").trim();
  if (normalized.toLowerCase() === "unauthorized") return true;
  return SESSION_AUTH_MESSAGES.has(normalized);
}

/**
 * Map legacy Unauthorized or pass through layman session messages from API.
 * @param {string} text
 */
export function resolveSessionAuthDisplayMessage(text) {
  const normalized = String(text || "").trim();
  if (SESSION_AUTH_MESSAGES.has(normalized)) return normalized;
  if (normalized.toLowerCase() === "unauthorized") return apiUserMessage("sessionExpired");
  return normalized;
}

/**
 * @param {unknown} payload
 * @param {string} [fallback]
 */
export function formatApiErrorPayload(payload, fallback = apiUserMessage("genericServer")) {
  const error = String(payload?.error || fallback).trim() || fallback;
  const hint = payload?.hint != null ? String(payload.hint).trim() : "";
  return hint ? `${error} ${hint}` : error;
}

/**
 * @param {unknown} err
 * @param {{ fallback?: string }} [options]
 */
export function formatUserFacingError(err, options = {}) {
  const fallback = options.fallback ?? apiUserMessage("genericServer");
  if (isNetworkFetchError(err)) {
    return apiUserMessage("networkUnreachable");
  }
  const msg = err instanceof Error ? String(err.message || "").trim() : String(err || "").trim();
  if (!msg) return fallback;
  if (isUnauthorizedMessage(msg)) {
    return resolveSessionAuthDisplayMessage(msg);
  }
  return msg;
}

/**
 * @param {Response} res
 * @returns {Promise<object | null>}
 */
export async function readJsonResponse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Parse response body and return layman message (error + hint) for failed requests.
 * @param {Response} res
 * @param {string} fallback
 */
export async function readApiErrorMessage(res, fallback) {
  const payload = await readJsonResponse(res);
  if (payload && (payload.error || payload.hint)) {
    return formatApiErrorPayload(payload, fallback);
  }
  return fallback;
}

/**
 * @param {Response} res
 * @param {string} fallback
 * @returns {Promise<object | null>}
 */
export async function fetchApiJson(res, fallback) {
  const payload = await readJsonResponse(res);
  if (!res.ok) {
    throw new Error(formatApiErrorPayload(payload, fallback));
  }
  return payload;
}

/**
 * Trigger browser download from a PDF (or binary) API response.
 * @param {Response} res
 * @param {string} fallbackErrorMessage
 * @param {string} [defaultFilename]
 */
export async function downloadBlobResponse(res, fallbackErrorMessage, defaultFilename = "download.pdf") {
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res, fallbackErrorMessage));
  }
  const blob = await res.blob();
  const disp = res.headers.get("Content-Disposition") || "";
  const m = /filename="([^"]+)"/i.exec(disp);
  const filename = m?.[1] || defaultFilename;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
