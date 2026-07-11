// Application API route — health check for operators and deploy scripts.

/**
 * GET /api/health/db — lightweight DB connectivity check for production deploys.
 * Does not expose credentials; returns a short hint on failure.
 */
import pool, {
  getLoopbackDbHostError,
  getMissingRequiredDbEnvVars,
  getResolvedDbHostForDiagnostics
} from "../../../../../lib/db";
import { getDbErrorHint } from "../../../../../lib/dbConnectionError";

/**
 * GET /api/health/db — ping the database (ops / readiness check).
 */
// Quick DB ping for deploy scripts and operators (no secrets in response).
export async function GET() {
  // Fail fast when required DB_* env vars are not configured.
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

  // Block misconfigured hosts that point at localhost from the cloud.
  const loopback = getLoopbackDbHostError();
  if (loopback) {
    return Response.json({ ok: false, hint: loopback }, { status: 503 });
  }

  // Prove the pool can run a simple query against RDS/MySQL.
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
        host: getResolvedDbHostForDiagnostics(),
        hint: getDbErrorHint(error) || "Database connection failed. Check Amplify logs and RDS security group / SSL settings."
      },
      { status: 503 }
    );
  }
}

