"use client";

// Generic/shared file used across modules.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Header strip: ambient micro-icon lane (React-timed bursts), IST clock, theme, user menu.
 */
import ThemeToggle from "./ThemeToggle";
import TopbarIstClock from "./TopbarIstClock";
import TopbarMicroFloatLane from "./TopbarMicroFloatLane";
import UserMenu from "./UserMenu";

/**
 * Expands in the topbar; micro lane fills remaining width (flex: 1).
 * @param {{ userEmail: string }} props
 */
export default function DashboardTopbar({ userEmail }) {
  return (
    <div className="dashboard-topbar-actions">
      <TopbarMicroFloatLane />
      <TopbarIstClock />
      <ThemeToggle />
      <UserMenu email={userEmail} />
    </div>
  );
}
