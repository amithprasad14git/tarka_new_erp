// Configuration file for project/runtime behavior.
// Keep module-specific business logic in lib/modules/<module> files.

/** @type {import("next").NextConfig} */
const nextConfig = {
  // pdfkit loads .afm metrics from disk; bundling it breaks at runtime.
  serverExternalPackages: ["pdfkit"],
  // Old bookmark path after module rename employees → employee_master.
  async redirects() {
    return [
      {
        source: "/dashboard/employees",
        destination: "/dashboard/employee_master",
        permanent: true
      }
    ];
  }
};

module.exports = nextConfig;
