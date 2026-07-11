"use client";

// Compact topbar weather (Open-Meteo via /api/dashboard/weather).

import { useCallback, useEffect, useState } from "react";
import { getWeatherWithFallback } from "../lib/topbarWeatherClient";

/** WMO weathercode → visual kind for icon + motion (Open-Meteo / WMO). */
function kindFromCode(code) {
  if (code == null || Number.isNaN(code)) return "cloud";
  const c = Number(code);
  // Map Open-Meteo WMO weather codes to a small set of icon styles.
  if (c === 0) return "clear";
  if (c <= 2) return "partly";
  if (c === 3) return "cloud";
  if (c <= 48) return "fog";
  if (c <= 67) return "rain";
  if (c <= 77) return "snow";
  if (c <= 82) return "showers";
  if (c <= 86) return "snow";
  if (c >= 95) return "storm";
  return "cloud";
}

const GLYPH = {
  clear: "\u2600",
  partly: "\u26c5",
  cloud: "\u2601",
  fog: "\u{1F32B}",
  rain: "\u{1F327}",
  showers: "\u{1F327}",
  snow: "\u2744",
  storm: "\u26c8",
};

function nextRefreshMs() {
  return (15 + Math.random() * 15) * 60 * 1000;
}

/**
 * Renders immediately with a loading line (does not wait on geolocation before paint).
 * Uses {@link getWeatherWithFallback}: tries GPS briefly, then Mysuru server default if needed.
 */
export default function TopbarWeather() {
  const [status, setStatus] = useState(/** @type {'loading' | 'ready' | 'error'} */ ("loading"));
  const [data, setData] = useState(
    /** @type {{ temperatureC: number, weatherCode: number, cityLabel: string } | null} */ (null)
  );

  /** @param {import('../lib/topbarWeatherClient.js').WeatherFetchResult} result */
  const applyResult = useCallback((result) => {
    if (result.ok) {
      setData({
        temperatureC: result.temperatureC,
        weatherCode: result.weatherCode,
        cityLabel: result.cityLabel,
      });
      setStatus("ready");
    } else {
      setData(null);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let pollId = null;

    // Poll on a staggered interval (15–30 min) after the first fetch.
    async function runPoll() {
      const result = await getWeatherWithFallback();
      if (cancelled) return;
      applyResult(result);
      pollId = window.setTimeout(runPoll, nextRefreshMs());
    }

    async function runInitial() {
      const result = await getWeatherWithFallback();
      if (cancelled) return;
      applyResult(result);
      pollId = window.setTimeout(runPoll, nextRefreshMs());
    }

    runInitial();

    return () => {
      cancelled = true;
      if (pollId) window.clearTimeout(pollId);
    };
  }, [applyResult]);

  const labelReady =
    status === "ready" && data
      ? `Weather in ${data.cityLabel}, ${data.temperatureC}°C`
      : undefined;

  return (
    <div className="topbar-weather-cluster">
      <span className="topbar-sep topbar-sep--rail" aria-hidden="true" />
      <div
        className="topbar-weather"
        role="status"
        aria-live="polite"
        aria-label={labelReady}
      >
        {status === "loading" && (
          <span className="topbar-weather-loading muted">Loading Weather...</span>
        )}
        {status === "error" && (
          <span className="topbar-weather-fallback muted">Weather unavailable</span>
        )}
        {status === "ready" && data && (
          <>
            <span className="topbar-weather-icon-wrap" aria-hidden="true">
              <span
                className={`topbar-weather-icon topbar-weather-icon--${kindFromCode(data.weatherCode)}`}
              >
                {GLYPH[kindFromCode(data.weatherCode)] ?? GLYPH.cloud}
              </span>
            </span>
            <span className="topbar-weather-meta">
              <span className="topbar-weather-temp">{data.temperatureC}°C</span>
              <span className="topbar-weather-city">{data.cityLabel}</span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

