"use client";

// Application page or layout — what users see in the browser.

/**
 * Next.js page/layout: dashboard/employee_master/page.js
 */

// Application route/page/API handler for this feature area.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Employee Master screen (same behaviour as opening `employee_master` from the dashboard tabs).
 */
import MasterModuleClient from "../../../components/MasterModuleClient";

export default function EmployeeMasterPage() {
  // Direct URL to Employee Master uses the same grid/form client as dashboard tabs.
  return <MasterModuleClient moduleKey="employee_master" isActive />;
}

