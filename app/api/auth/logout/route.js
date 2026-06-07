/**
 * HTTP handler for `/api/auth/logout`.
 * Business rules live in lib/modules; this file loads data and returns JSON or files.
 */

// Application route/page/API handler for this feature area.
// Keep module-specific business logic in lib/modules/<module> files.

import { cookies } from "next/headers";
import { deleteSession } from "../../../../lib/session";

/**
 * Clears session cookie and deletes session row in DB.
 * This invalidates the server-side session so reusing the cookie no longer authenticates.
 */
// Sign out: delete server session row and clear the session cookie.
export async function POST() {
  try {
    // Read current session id from httpOnly cookie.
    const cookieStore = await cookies();
    const sid = cookieStore.get("session")?.value;

    // Delete DB session row (safe no-op if sid is missing).
    await deleteSession(sid);

    // Remove the cookie from the browser.
    cookieStore.delete("session");
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Logout API error:", error);
    return Response.json({ error: "Logout failed" }, { status: 500 });
  }
}

