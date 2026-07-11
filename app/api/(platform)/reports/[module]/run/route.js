// Application API route — run report (HTML JSON or Excel download).

/**
 * GET /api/reports/<reportKey>/run?format=html|excel&<filter>=...
 * Query params = report filters; optional filterLabels JSON for header display text.
 * Delegates to lib/reports/report.service.js. See README.md#reports-frozen-framework.
 */

import { requireRequestUser } from "../../../../../../lib/requestSession";
import { isReportKey } from "../../../../../../lib/reportConfig";
import { runReportForUser } from "../../../../../../lib/reports/report.service";
import { jsonApiErrorForAction } from "../../../../../../lib/apiErrorResponse";

function parseFiltersFromUrl(url) {
  const out = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (key === "format") continue;
    out[key] = value;
  }
  return out;
}

function parseFilterLabels(url) {
  const raw = url.searchParams.get("filterLabels");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * GET /api/reports/:module/run — run a report with query filters and return rows/meta.
 */
export async function GET(req, { params }) {
  try {
    const auth = await requireRequestUser(req);
    if (auth.unauthorized) return auth.unauthorized;
    const user = auth.user;
    const { module: reportKey } = await params;

    // Report keys live in config/reports.js (not config/modules.js).
    if (!isReportKey(reportKey)) {
      return Response.json({ error: "Unknown report" }, { status: 404 });
    }

    const url = new URL(req.url);
    const format = (url.searchParams.get("format") || "html").toLowerCase();
    const filters = parseFiltersFromUrl(url);
    const filterLabels = parseFilterLabels(url);

    const result = await runReportForUser(user, reportKey, filters, {
      format: format === "excel" ? "excel" : "html",
      filterLabels
    });

    if (result.status === 403) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (result.status === 400) {
      return Response.json(result.body, { status: 400 });
    }
    if (result.status === 404) {
      return Response.json(result.body, { status: 404 });
    }
    if (result.status !== 200) {
      return Response.json(result.body || { error: "Failed to run report" }, { status: result.status });
    }

    // Excel — binary .xlsx with Content-Disposition filename from report.service.js.
    if (result.excel) {
      return new Response(result.buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${result.filename}"`
        }
      });
    }

    return Response.json(result.body);
  } catch (e) {
    const format = new URL(req.url).searchParams.get("format");
    const key = String(format || "").toLowerCase() === "excel" ? "exportReport" : "runReport";
    return jsonApiErrorForAction(e, key, { logLabel: "report run" });
  }
}

