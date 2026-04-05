"use client";

/**
 * Dedicated route for Employee Master (same screen as `/dashboard/[module]` when module is `employee_master`).
 */
import EmployeesModuleClient from "../../../components/EmployeesModuleClient";

export default function EmployeeMasterPage() {
  return <EmployeesModuleClient isActive={true} />;
}
