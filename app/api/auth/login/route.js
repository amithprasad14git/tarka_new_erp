/**
 * POST /api/auth/login — JSON `{ email, password }` → `authenticateLogin` (active must be Yes) → `createSession` → cookie.
 * Session id lives in the cookie; user mapping and expiry are in DB (`sessions` table). Cookie is httpOnly to reduce XSS risk.
 */
import { authenticateLogin } from "../../../../lib/auth";
import { createSession } from "../../../../lib/session";
import { cookies } from "next/headers";

export async function POST(req) {
  try {
    // Expect JSON body: { email, password }
    const { email, password } = await req.json();
    const result = await authenticateLogin(email, password);

    if ("error" in result) {
      if (result.error === "inactive") {
        return Response.json(
          { error: "This account is inactive. Contact an administrator." },
          { status: 403 }
        );
      }
      // invalid_credentials — same message whether email unknown or password wrong.
      return Response.json({ error: "Invalid Email or Password" }, { status: 401 });
    }

    const { user } = result;

    // Creates a server-side session row and returns its random id.
    const sid = await createSession(user.id);
    const cookieStore = await cookies();

    // Store the session id in a cookie; the app uses it to resolve user on subsequent requests.
    cookieStore.set("session", sid, { httpOnly: true, path: "/" });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Login API error:", error);
    return Response.json(
      { error: "Login failed on Server. Check DB Connection." },
      { status: 500 }
    );
  }
}
