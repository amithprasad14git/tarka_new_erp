import { redirect } from "next/navigation";

/**
 * Old path; module key is now `employee_master`. Keeps bookmarks working.
 */
export default function EmployeesLegacyRedirectPage() {
  redirect("/dashboard/employee_master");
}
