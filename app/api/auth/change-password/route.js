import { cookies } from "next/headers";
import pool from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/session";
import { escapeSqlTableId } from "../../../../lib/sqlModuleTable";

function normalizeText(value) {
  return String(value ?? "").trim();
}

export async function POST(req) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get("session")?.value;
    const sessionUser = await getSessionUser(sid);
    if (!sessionUser?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const currentPassword = String(body?.currentPassword ?? "");
    const newPassword = String(body?.newPassword ?? "");
    const confirmPassword = String(body?.confirmPassword ?? "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      return Response.json({ error: "All password fields are required." }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return Response.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    }
    if (normalizeText(newPassword) !== normalizeText(confirmPassword)) {
      return Response.json({ error: "New password and confirm password do not match." }, { status: 400 });
    }
    if (currentPassword === newPassword) {
      return Response.json(
        { error: "New password must be different from current password." },
        { status: 400 }
      );
    }

    const ut = escapeSqlTableId("users");
    const [rows] = await pool.query(`SELECT id, password FROM ${ut} WHERE id=? LIMIT 1`, [
      sessionUser.id
    ]);
    const user = rows?.[0];
    if (!user) {
      return Response.json({ error: "User not found." }, { status: 404 });
    }

    const storedPassword = String(user.password ?? "");
    const ok = storedPassword === currentPassword;
    if (!ok) {
      return Response.json({ error: "Current password is incorrect." }, { status: 400 });
    }

    await pool.query(`UPDATE ${ut} SET password = ? WHERE id = ?`, [newPassword, sessionUser.id]);

    return Response.json({ ok: true, message: "Password changed successfully." });
  } catch (error) {
    console.error("Change password API error:", error);
    return Response.json({ error: "Failed to change password." }, { status: 500 });
  }
}
