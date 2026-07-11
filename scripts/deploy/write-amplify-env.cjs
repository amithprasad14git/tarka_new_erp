/**
 * Writes DB_* and SESSION_* from the build environment into .env.production for Next.js SSR on Amplify.
 * Safer than `env | grep` when passwords contain $, quotes, or newlines.
 */
const fs = require("fs");

const KEYS = [
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASS",
  "DB_NAME",
  "DB_SSL",
  "DB_SSL_CA",
  "DB_SSL_CA_PEM",
  "DB_SSL_REJECT_UNAUTHORIZED",
  "DB_POOL_LIMIT",
  "SESSION_IDLE_MINUTES",
  "NEXT_PUBLIC_SESSION_IDLE_MINUTES"
];

// Collect only the env vars Amplify provides; skip empty ones.
const lines = [];
for (const key of KEYS) {
  const value = process.env[key];
  // Skip unset or blank values so we do not write empty lines to .env.production.
  if (value == null || String(value).trim() === "") continue;
  // JSON.stringify wraps the value in quotes and escapes special characters safely.
  lines.push(`${key}=${JSON.stringify(String(value))}`);
}

// Write the collected lines to the file Next.js reads during production builds.
fs.writeFileSync(".env.production", `${lines.join("\n")}\n`, "utf8");
const names = lines.map((l) => l.split("=")[0]);
console.log(
  `[write-amplify-env] Wrote ${names.length} variable(s) to .env.production: ${names.join(", ") || "(none — set DB_* in Amplify console)"}`
);
