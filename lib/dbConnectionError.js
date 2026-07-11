// Shared library helper for reusable application logic.
// Maps mysql2 / network errors to operator-facing hints (no secrets).

/**
 * Turns database connection errors into plain-English hints for login and deploy logs.
 * Does not expose passwords or connection strings.
 *
 * @param {unknown} error
 * @returns {string | null} Actionable hint for deploy logs / API responses
 */
export function getDbErrorHint(error) {
  if (!error || typeof error !== "object") return null;

  const code = String(error.code || "").toUpperCase();
  const errno = error.errno;
  const msg = String(error.message || "");
  const sqlMessage = String(error.sqlMessage || "");

  // Prefer explicit messages thrown by our own DB bootstrap checks.
  if (msg.includes("DB_HOST is empty") || msg.includes("DB_HOST cannot be localhost")) {
    return msg;
  }

  if (code === "ECONNREFUSED") {
    return "Cannot connect to the database host (connection refused). On AWS, set DB_HOST to your RDS endpoint—not localhost—and ensure the database is running.";
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return "Database hostname could not be resolved. Check DB_HOST spelling (RDS endpoint from the AWS console).";
  }
  if (code === "ETIMEDOUT" || code === "PROTOCOL_CONNECTION_LOST" || code === "ECONNRESET") {
    return "Database connection timed out or dropped. For RDS: open the security group to your host (Amplify may need publicly accessible RDS or a VPC connector), and set DB_SSL=true for encrypted connections.";
  }
  if (code === "ER_ACCESS_DENIED_ERROR" || errno === 1045) {
    return "Database rejected DB_USER / DB_PASS. Verify credentials in your hosting environment variables match the MySQL user.";
  }
  if (
    code === "HANDSHAKE_SSL_ERROR" ||
    code === "ER_SSL_CONNECTION_ERROR" ||
    /SSL|TLS|certificate/i.test(msg) ||
    /SSL|TLS|certificate/i.test(sqlMessage)
  ) {
    return "TLS/SSL is required for this database. Set DB_SSL=true. On Amplify, use DB_SSL_CA_PEM with the RDS combined CA bundle (see README Environment / DB Notes).";
  }
  if (code === "ER_BAD_DB_ERROR" || errno === 1049) {
    return "Database DB_NAME does not exist on the server. Create the schema or fix DB_NAME.";
  }
  if (code === "ER_NO_SUCH_TABLE" || errno === 1146) {
    if (/sessions/i.test(sqlMessage)) {
      return "Table `sessions` is missing. Run your database migrations / schema setup before login.";
    }
    if (/users/i.test(sqlMessage)) {
      return "Table `users` is missing. Run your database migrations / schema setup before login.";
    }
    return "A required database table is missing. Ensure the full schema is deployed.";
  }

  return null;
}


