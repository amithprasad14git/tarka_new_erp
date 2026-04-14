/** @type {import("next").NextConfig} */
const nextConfig = {
  // pdfkit loads .afm metrics from disk; bundling it breaks at runtime.
  serverExternalPackages: ["pdfkit"]
};

module.exports = nextConfig;
