// Application route/page/API handler for this feature area.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * POST /api/auth/login — JSON `{ username, password }` → `authenticateLogin` (active must be Yes) → `createSession` → cookie.
 * Session id lives in the cookie; user mapping and expiry are in DB (`sessions` table). Cookie is httpOnly to reduce XSS risk.
 */
import { authenticateLogin } from "../../../../../lib/auth";
import { createSession } from "../../../../../lib/session";
import { getLoopbackDbHostError, getMissingRequiredDbEnvVars } from "../../../../../lib/db";
import { jsonApiErrorForAction } from "../../../../../lib/apiErrorResponse";
import { apiUserMessage } from "../../../../../lib/apiUserMessages";
import { cookies } from "next/headers";

/**
 * POST /api/auth/login — validate credentials, create session, set httpOnly cookie.
 */
// Validate email/password, create DB session, set httpOnly session cookie.
export async function POST(req) {
  try {
    const missingDb = getMissingRequiredDbEnvVars();
    if (missingDb.length) {
      console.error("Login: missing database env vars:", missingDb.join(", "));
      return Response.json(
        {
          error: apiUserMessage("loginConfig")
        },
        { status: 503 }
      );
    }

    const loopbackErr = getLoopbackDbHostError();
    if (loopbackErr) {
      console.error("Login:", loopbackErr);
      return Response.json({ error: loopbackErr }, { status: 503 });
    }

    // Expect JSON body: { username, password }
    const { username, password } = await req.json();
    const result = await authenticateLogin(username, password);

    if ("error" in result) {
      if (result.error === "inactive") {
        return Response.json(
          { error: "This account is inactive. Contact the administrator." },
          { status: 403 }
        );
      }
      // invalid_credentials — same message whether username unknown or password wrong.
      return Response.json({ error: "Invalid Username or Password" }, { status: 401 });
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
    return jsonApiErrorForAction(error, "loginFailed", { logLabel: "Login API" });
  }
}


