/**
 * Next.js page/layout: dashboard/employees/page.js
 */

// Application route/page/API handler for this feature area.
// Keep module-specific business logic in lib/modules/<module> files.

import { redirect } from "next/navigation";

/**
 * Old path; module key is now `employee_master`. Keeps bookmarks working.
 */
export default function EmployeesLegacyRedirectPage() {
  // Old bookmark path — module was renamed to employee_master.
  redirect("/dashboard/employee_master");
}

