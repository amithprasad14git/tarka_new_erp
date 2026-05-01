// Application route/page/API handler for this feature area.
// Keep module-specific business logic in lib/modules/<module> files.

import { redirect } from "next/navigation";

/**
 * Root URL: send users to login.
 * Note: dashboard routes enforce auth via their server layout (redirects to login).
 */
export default function HomePage() {
  redirect("/login");
}
