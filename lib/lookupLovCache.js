// In-memory cache for lookup LoV API responses (shared across remounts / Strict Mode).

/** @type {Map<string, Promise<unknown[]>>} */
const inflight = new Map();

/** @type {Map<string, unknown[]>} */
const settled = new Map();

/**
 * @param {string} cacheKey Stable key for this LoV query (module + filters + sort).
 * @param {() => Promise<unknown[]>} loader
 * @returns {Promise<unknown[]>}
 */
export async function fetchLookupLovCached(cacheKey, loader) {
  if (settled.has(cacheKey)) {
    return settled.get(cacheKey);
  }
  if (inflight.has(cacheKey)) {
    return inflight.get(cacheKey);
  }
  const promise = loader()
    .then((rows) => {
      const data = Array.isArray(rows) ? rows : [];
      settled.set(cacheKey, data);
      inflight.delete(cacheKey);
      return data;
    })
    .catch((err) => {
      inflight.delete(cacheKey);
      throw err;
    });
  inflight.set(cacheKey, promise);
  return promise;
}

/** @param {string} [cacheKey] Clear one entry; omit to clear all (tests). */
export function clearLookupLovCache(cacheKey) {
  if (cacheKey) {
    settled.delete(cacheKey);
    inflight.delete(cacheKey);
    return;
  }
  settled.clear();
  inflight.clear();
}

/**
 * @param {object} lookupFetchConfig
 * @param {string} labelField
 * @returns {string}
 */
export function buildLookupLovCacheKey(lookupFetchConfig, labelField) {
  const extraEntries = Object.entries(lookupFetchConfig?.extraLovParams || {})
    .map(([k, v]) => [String(k || "").trim(), v == null ? "" : String(v).trim()])
    .filter(([k, v]) => Boolean(k) && Boolean(v))
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify({
    module: String(lookupFetchConfig?.module || ""),
    filterLookupTypeName: String(lookupFetchConfig?.filterLookupTypeName || ""),
    filterLookupType: String(lookupFetchConfig?.filterLookupType || ""),
    labelField: String(labelField || "id"),
    extraEntries
  });
}
