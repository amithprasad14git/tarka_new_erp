"use client";

/**
 * Header strip on the right: theme toggle and user menu (passed from dashboard layout with session email).
 */
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";

/**
 * Right-aligned header actions: theme toggle + user menu (all modules).
 * @param {{ userEmail: string }} props
 */
export default function DashboardTopbar({ userEmail }) {
  return (
    // This layout is shared across all dashboard screens.
    <div className="dashboard-topbar-actions">
      <ThemeToggle />
      <UserMenu email={userEmail} />
    </div>
  );
}
