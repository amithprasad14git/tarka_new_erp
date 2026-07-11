/**
 * =============================================================================
 * FETCH CLIENT ERROR — Browser-side API failure formatting
 * =============================================================================
 * Client components call `/api/*` with `fetch`. Failures may be network drops,
 * session 401s, or JSON `{ error, hint }` bodies. This module turns those into
 * a single string operators can read, and helpers for JSON parse / PDF download.
 * =============================================================================
 */

import { apiUserMessage } from "./apiUserMessages";

const SESSION_AUTH_MESSAGES = new Set([
  apiUserMessage("sessionExpired"),
  apiUserMessage("sessionInactive"),
  apiUserMessage("sessionReplaced")
]);

/**
 * Detect browser “could not reach server” fetch failures (offline, CORS, etc.).
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
 * True when text is a generic Unauthorized or a known session sign-out message.
 * Used so UI can treat auth failures consistently (e.g. redirect to login).
 * @param {string} text
 * @returns {boolean}
 */
export function isUnauthorizedMessage(text) {
  const normalized = String(text || "").trim();
  if (normalized.toLowerCase() === "unauthorized") return true;
  return SESSION_AUTH_MESSAGES.has(normalized);
}

/**
 * Map legacy “Unauthorized” or pass through layman session messages from API.
 * Ensures older responses still show the standard “session expired” copy.
 * @param {string} text
 * @returns {string}
 */
export function resolveSessionAuthDisplayMessage(text) {
  const normalized = String(text || "").trim();
  if (SESSION_AUTH_MESSAGES.has(normalized)) return normalized;
  if (normalized.toLowerCase() === "unauthorized") return apiUserMessage("sessionExpired");
  return normalized;
}

/**
 * Combine API JSON `error` + optional `hint` into one display string.
 * @param {unknown} payload
 * @param {string} [fallback]
 * @returns {string}
 */
export function formatApiErrorPayload(payload, fallback = apiUserMessage("genericServer")) {
  const error = String(payload?.error || fallback).trim() || fallback;
  const hint = payload?.hint != null ? String(payload.hint).trim() : "";
  return hint ? `${error} ${hint}` : error;
}

/**
 * Turn any thrown value into a safe string for toasts / inline errors.
 * Network and session cases get dedicated layman messages.
 * @param {unknown} err
 * @param {{ fallback?: string }} [options]
 * @returns {string}
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
 * Read response body as JSON, or null if empty / not JSON.
 * Avoids throwing on HTML error pages so callers can show a fallback message.
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
 * @returns {Promise<string>}
 */
export async function readApiErrorMessage(res, fallback) {
  const payload = await readJsonResponse(res);
  if (payload && (payload.error || payload.hint)) {
    return formatApiErrorPayload(payload, fallback);
  }
  return fallback;
}

/**
 * Parse JSON body; throw a layman Error when `res.ok` is false.
 * Happy path returns the parsed payload (or null for empty body).
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
 * Uses Content-Disposition filename when present; otherwise `defaultFilename`.
 * @param {Response} res
 * @param {string} fallbackErrorMessage
 * @param {string} [defaultFilename]
 * @returns {Promise<void>}
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
