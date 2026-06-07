// Configuration file for project/runtime behavior.
// Keep module-specific business logic in lib/modules/<module> files.

/** @type {import("next").NextConfig} */
const nextConfig = {
  // pdfkit loads .afm metrics from disk; bundling it breaks at runtime.
  serverExternalPackages: ["pdfkit"]
};

module.exports = nextConfig;
