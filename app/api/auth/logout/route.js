import { cookies } from "next/headers";
import { deleteSession } from "../../../../lib/session";

/**
 * Clears session cookie and deletes session row in DB.
 * This invalidates the server-side session so reusing the cookie no longer authenticates.
 */
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
