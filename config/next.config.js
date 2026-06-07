/**
 * next.config — central settings read by the app at startup or on each request.
 */

// Configuration file for project/runtime behavior.
// Keep module-specific business logic in lib/modules/<module> files.

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: build produces plain HTML/JS files (e.g. for Amplify hosting without a Node server).
  output: "export",
  // pdfkit uses native/font assets; keep it out of the bundled server so PDF routes can load it at runtime.
  serverExternalPackages: ["pdfkit"]
};

module.exports = nextConfig;
