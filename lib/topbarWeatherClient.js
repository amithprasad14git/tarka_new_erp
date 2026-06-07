// Client-only helpers for dashboard topbar weather (no React; safe to import from "use client" components).

/**
 * Default city shown when the browser position is not used.
 * Mysuru is a stable, in-product baseline so forecasts work without geolocation permission.
 */
export const DEFAULT_WEATHER_CITY = "Mysuru";

/** Do not block the UI longer than this waiting on `navigator.geolocation`. */
const GEO_TIMEOUT_MS = 4000;

/**
 * Try to read the device location once. Returns `null` if:
 * - API missing,
 * - user denies / browser blocks,
 * - or nothing resolves within {@link GEO_TIMEOUT_MS} (timeout handling).
 */
async function tryGetCoordinates() {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    const done = /** @param {GeolocationCoordinates | null} c */ (c) => {
      clearTimeout(failsafe);
      resolve(c);
    };

    const failsafe = setTimeout(() => done(null), GEO_TIMEOUT_MS);

    navigator.geolocation.getCurrentPosition(
      (pos) => done(pos.coords),
      () => done(null),
      {
        enableHighAccuracy: false,
        maximumAge: 30 * 60 * 1000,
        /** Align with outer failsafe — geolocation fallback triggers if this fires too */
        timeout: GEO_TIMEOUT_MS,
      }
    );
  });
}

/**
 * @typedef {{ ok: true, temperatureC: number, weatherCode: number, cityLabel: string } | { ok: false }} WeatherFetchResult
 */

/**
 * Fetches current conditions from `/api/dashboard/weather`.
 * - If coordinates are obtained, the API uses them (+ reverse geocode for the label).
 * - Otherwise the server uses the configured default (Mysuru) — **no permission popup required** for that path.
 *
 * @returns {Promise<WeatherFetchResult>}
 */
export async function getWeatherWithFallback() {
  const coords = await tryGetCoordinates();

  // Pass GPS to the API when available; otherwise server falls back to default city.
  const qs =
    coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude)
      ? `?lat=${encodeURIComponent(coords.latitude)}&lon=${encodeURIComponent(coords.longitude)}`
      : "";

  try {
    const res = await fetch(`/api/dashboard/weather${qs}`, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));

    if (!res.ok || !body?.ok) {
      return { ok: false };
    }

    const cityLabel =
      String(body.cityLabel || "").trim() || DEFAULT_WEATHER_CITY;

    return {
      ok: true,
      temperatureC: body.temperatureC,
      weatherCode: body.weatherCode,
      cityLabel,
    };
  } catch {
    return { ok: false };
  }
}

