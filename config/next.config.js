// Configuration file for project/runtime behavior.
// Keep module-specific business logic in lib/modules/<module> files.

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export", // enables static HTML export
  // If you use this file as the active config (`next dev -c config/next.config.js`), keep pdfkit external:
  serverExternalPackages: ["pdfkit"]
};

module.exports = nextConfig;