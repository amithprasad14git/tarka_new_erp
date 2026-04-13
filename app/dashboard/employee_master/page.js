"use client";

/**
 * Employee Master screen (same behaviour as opening `employee_master` from the dashboard tabs).
 */
import MasterModuleClient from "../../../components/MasterModuleClient";

export default function EmployeeMasterPage() {
  return <MasterModuleClient moduleKey="employee_master" isActive />;
}
