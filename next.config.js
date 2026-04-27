/** @type {import("next").NextConfig} */
const nextConfig = {
  // pdfkit loads .afm metrics from disk; bundling it breaks at runtime.
  serverExternalPackages: ["pdfkit"],
  // Allow Playwright webServer host used in local E2E runs.
  allowedDevOrigins: ["127.0.0.1", "localhost"]
};

module.exports = nextConfig;
