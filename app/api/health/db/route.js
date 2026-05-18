/**
 * GET /api/health/db — lightweight DB connectivity check for production deploys.
 * Does not expose credentials; returns a short hint on failure.
 */
import pool, {
  getLoopbackDbHostError,
  getMissingRequiredDbEnvVars
} from "../../../../lib/db";
import { getDbErrorHint } from "../../../../lib/dbConnectionError";

export async function GET() {
  const missing = getMissingRequiredDbEnvVars();
  if (missing.length) {
    return Response.json(
      {
        ok: false,
        missing,
        hint: "Set DB_HOST, DB_USER, DB_PASS, and DB_NAME in your hosting environment (Amplify → Environment variables)."
      },
      { status: 503 }
    );
  }

  const loopback = getLoopbackDbHostError();
  if (loopback) {
    return Response.json({ ok: false, hint: loopback }, { status: 503 });
  }

  try {
    await pool.query("SELECT 1 AS ok");
    return Response.json({ ok: true });
  } catch (error) {
    console.error("health/db:", {
      message: error?.message,
      code: error?.code,
      errno: error?.errno
    });
    return Response.json(
      {
        ok: false,
        code: error?.code ?? null,
        hint: getDbErrorHint(error) || "Database connection failed. Check Amplify logs and RDS security group / SSL settings."
      },
      { status: 503 }
    );
  }
}
