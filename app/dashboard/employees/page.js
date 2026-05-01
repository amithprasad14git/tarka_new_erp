// Application route/page/API handler for this feature area.
// Keep module-specific business logic in lib/modules/<module> files.

import { redirect } from "next/navigation";

/**
 * Old path; module key is now `employee_master`. Keeps bookmarks working.
 */
export default function EmployeesLegacyRedirectPage() {
  redirect("/dashboard/employee_master");
}
