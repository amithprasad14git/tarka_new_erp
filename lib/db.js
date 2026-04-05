/**
 * Shared MySQL pool for the whole app (server-side only).
 *
 * Environment: DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT, optional DB_SSL / DB_SSL_CA / DB_SSL_CA_PEM,
 * DB_POOL_LIMIT (default 5, max 25). Uses one pool per Node process via globalThis to avoid
 * duplicate pools when Next.js loads this module from several server bundles (prevents MySQL
 * “Too many connections”).
 */
import fs from "fs";
import mysql from "mysql2/promise";

/**
 * Optional TLS for AWS RDS / MySQL 8.x (often required for public endpoints).
 * Set `DB_SSL=true` and optionally `DB_SSL_CA` to the RDS combined CA bundle path
 * (see AWS docs: "Using SSL/TLS to encrypt a connection to a DB instance").
 */
function buildSslOption() {
  const v = String(process.env.DB_SSL || "").toLowerCase();
  if (v !== "1" && v !== "true" && v !== "yes") return undefined;

  const ssl = {};
  const caPem = process.env.DB_SSL_CA_PEM;
  if (caPem) {
    ssl.ca = caPem.replace(/\\n/g, "\n");
  } else {
    const caPath = process.env.DB_SSL_CA;
    if (caPath) {
      try {
        if (fs.existsSync(caPath)) ssl.ca = fs.readFileSync(caPath);
      } catch {
        /* path invalid on serverless — use DB_SSL_CA_PEM in Amplify */
      }
    }
  }
  const reject =
    process.env.DB_SSL_REJECT_UNAUTHORIZED === "false"
      ? false
      : Boolean(ssl.ca);
  ssl.rejectUnauthorized = reject;
  return ssl;
}

const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;

/** Keep small on RDS; each Next bundle could otherwise create its own pool in dev (see global singleton below). */
const connectionLimit = Math.min(Math.max(parseInt(process.env.DB_POOL_LIMIT || "5", 10), 1), 25);

function resolveMysqlHost() {
  return String(process.env.DB_HOST ?? "").trim();
}

/**
 * mysql2 treats a missing host as localhost → ECONNREFUSED on AWS. Use this in production routes
 * before opening connections.
 */
export function getLoopbackDbHostError() {
  if (process.env.NODE_ENV !== "production") return null;
  const host = resolveMysqlHost().toLowerCase();
  if (!host) return null;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return "DB_HOST is localhost; on Amplify use your RDS endpoint (e.g. mydb.xxxxx.region.rds.amazonaws.com), not localhost.";
  }
  return null;
}

function createPoolInstance() {
  const host = resolveMysqlHost();
  if (!host) {
    throw new Error(
      "DB_HOST is empty. Set DB_HOST to your RDS endpoint in Amplify → Environment variables."
    );
  }
  if (process.env.NODE_ENV === "production") {
    const h = host.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h === "::1") {
      throw new Error(
        "DB_HOST cannot be localhost in production. Use your RDS hostname from the AWS console."
      );
    }
  }
  return mysql.createPool({
    host,
    port: Number.isFinite(port) ? port : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    charset: "utf8mb4",
    ssl: buildSslOption(),
    connectTimeout: 20000,
    enableKeepAlive: true,
    waitForConnections: true,
    connectionLimit,
    /**
     * Drop idle connections back into the pool so long-lived dev servers do not hold slots forever.
     * (mysql2 supports this on Pool.)
     */
    maxIdle: Math.max(0, connectionLimit - 1)
  });
}

/**
 * Next.js may evaluate `lib/db` in more than one server bundle (especially in dev), which would
 * create multiple pools and exhaust MySQL (`ER_CON_COUNT_ERROR`). Reuse one pool per process.
 *
 * Lazy pool: env is read when the first query runs, and we never pass an implicit localhost when
 * DB_HOST was unset at module load.
 */
const g = globalThis;

function getPoolInternal() {
  if (!g.__erpMysqlPool) {
    g.__erpMysqlPool = createPoolInstance();
  }
  return g.__erpMysqlPool;
}

const pool = new Proxy(
  /** @type {import("mysql2/promise").Pool} */ ({}),
  {
    get(_target, prop, _receiver) {
      const p = getPoolInternal();
      const value = Reflect.get(p, prop, p);
      return typeof value === "function" ? value.bind(p) : value;
    },
  }
);

/** Names of required MySQL env vars that are missing or blank (for clearer deploy errors). */
export function getMissingRequiredDbEnvVars() {
  const keys = ["DB_HOST", "DB_USER", "DB_PASS", "DB_NAME"];
  return keys.filter((k) => !String(process.env[k] ?? "").trim());
}

export default pool;
