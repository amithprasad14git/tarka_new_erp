// Application API route — dashboard weather widget (no API key required).

/**
 * GET /api/dashboard/weather — lightweight weather for the top bar.
 * Uses Open-Meteo; optional reverse geocode via Nominatim (server-side only).
 */

/** Defaults match client `DEFAULT_WEATHER_CITY` (Mysuru) when no lat/lon query is sent. */
const DEFAULT_LAT = Number.parseFloat(process.env.WEATHER_DEFAULT_LAT ?? "12.2958");
const DEFAULT_LON = Number.parseFloat(process.env.WEATHER_DEFAULT_LON ?? "76.6394");
const DEFAULT_CITY = (process.env.WEATHER_DEFAULT_CITY ?? "Mysuru").trim() || "Mysuru";

const UA = "tarka-erp-dashboard-weather/1.0";

// Reject nonsense lat/lon from the browser before calling weather APIs.
function validCoord(lat, lon) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

// Turn GPS coordinates into a short city name for the top bar (OpenStreetMap).
/** @param {number} lat @param {number} lon @returns {Promise<string>} */
async function reverseCityLabel(lat, lon) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("format", "json");
  url.searchParams.set("zoom", "10");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": UA },
    next: { revalidate: 0 },
  });

  if (!res.ok) return "";

  /** @type {any} */
  const data = await res.json().catch(() => null);
  const a = data?.address || {};
  return (
    a.city ||
    a.town ||
    a.village ||
    a.county ||
    a.state ||
    a.region ||
    ""
  );
}

/**
 * GET /api/dashboard/weather
 * Query: lat, lon (optional). Omit to use WEATHER_DEFAULT_* env (or Mysuru).
 */
// Weather widget data for dashboard top bar (no API key; cached 10 minutes).
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const qLat = Number.parseFloat(searchParams.get("lat") ?? "");
    const qLon = Number.parseFloat(searchParams.get("lon") ?? "");

    // Use browser geolocation when valid; otherwise default city from env.
    const useDevice = validCoord(qLat, qLon);
    const lat = useDevice ? qLat : DEFAULT_LAT;
    const lon = useDevice ? qLon : DEFAULT_LON;

    // Fetch current temperature and WMO weather code from Open-Meteo.
    const wxUrl = new URL("https://api.open-meteo.com/v1/forecast");
    wxUrl.searchParams.set("latitude", String(lat));
    wxUrl.searchParams.set("longitude", String(lon));
    wxUrl.searchParams.set("current", "temperature_2m,weather_code");
    wxUrl.searchParams.set("timezone", "auto");

    const wxRes = await fetch(wxUrl.toString(), { next: { revalidate: 0 } });

    if (!wxRes.ok) {
      return Response.json({ ok: false }, { status: 502 });
    }

    /** @type {any} */
    const wx = await wxRes.json();
    const current = wx?.current || {};
    const temperatureC =
      typeof current.temperature_2m === "number" ? Math.round(current.temperature_2m) : null;
    const weatherCode =
      typeof current.weather_code === "number" ? current.weather_code : null;

    if (temperatureC == null || weatherCode == null) {
      return Response.json({ ok: false }, { status: 502 });
    }

    // Label: fixed default city, or reverse-geocoded name when user shared location.
    let cityLabel = DEFAULT_CITY;
    if (useDevice) {
      const label = await reverseCityLabel(lat, lon);
      cityLabel = String(label || "").trim() || "Local";
    }

    return Response.json(
      {
        ok: true,
        temperatureC,
        weatherCode,
        cityLabel,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, max-age=600",
        },
      }
    );
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}


