import { redirect } from "next/navigation";

/**
 * Root URL: send users to login.
 * Note: dashboard routes enforce auth via their server layout (redirects to login).
 */
export default function HomePage() {
  redirect("/login");
}
