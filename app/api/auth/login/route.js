/**
 * POST /api/auth/login — JSON `{ email, password }` → `authenticateLogin` (active must be Yes) → `createSession` → cookie.
 * Session id lives in the cookie; user mapping and expiry are in DB (`sessions` table). Cookie is httpOnly to reduce XSS risk.
 */
import { authenticateLogin } from "../../../../lib/auth";
import { createSession } from "../../../../lib/session";
import { getLoopbackDbHostError, getMissingRequiredDbEnvVars } from "../../../../lib/db";
import { cookies } from "next/headers";

export async function POST(req) {
  try {
    const missingDb = getMissingRequiredDbEnvVars();
    if (missingDb.length) {
      console.error("Login: missing database env vars:", missingDb.join(", "));
      return Response.json(
        {
          error:
            "Server is missing database configuration. Set DB_HOST, DB_USER, DB_PASS, and DB_NAME in Amplify environment variables.",
        },
        { status: 503 }
      );
    }

    const loopbackErr = getLoopbackDbHostError();
    if (loopbackErr) {
      console.error("Login:", loopbackErr);
      return Response.json({ error: loopbackErr }, { status: 503 });
    }

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
    const isProd = process.env.NODE_ENV === "production";
    cookieStore.set("session", sid, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: isProd,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Login API error:", {
      message: error?.message ?? String(error),
      code: error?.code,
      errno: error?.errno,
      sqlState: error?.sqlState,
      sqlMessage: error?.sqlMessage,
      stack: error?.stack,
    });
    return Response.json(
      { error: "Login failed on Server. Check DB Connection." },
      { status: 500 }
    );
  }
}
