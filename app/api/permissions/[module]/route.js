/**
 * Client helper: returns booleans canView / canCreate / canEdit / canDelete for one module key
 * so the UI can show or hide actions without embedding permission rules in the browser.
 */
import { modules } from "../../../../config/modules";
import { getSessionUser } from "../../../../lib/session";
import { hasModulePermission } from "../../../../lib/rbac";
import { cookies } from "next/headers";

/** Returns RBAC permissions for the logged-in user for a given module key. */
export async function GET(req, { params }) {
  try {
    // The client calls this route to decide which buttons to show (edit/delete/etc).
    const cookieStore = await cookies();
    const sid = cookieStore.get("session")?.value;
    const user = await getSessionUser(sid);

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // `params.module` comes from the dynamic route segment: `/api/permissions/:module`.
    const { module } = await params;
    const m = modules[module];
    if (!m) {
      return Response.json({ error: "Unknown module" }, { status: 404 });
    }

    // Resolve all permissions in parallel to keep UI responsive.
    const [canView, canCreate, canEdit, canDelete] = await Promise.all([
      hasModulePermission(user, module, "view"),
      hasModulePermission(user, module, "create"),
      hasModulePermission(user, module, "edit"),
      hasModulePermission(user, module, "delete")
    ]);

    return Response.json({
      module,
      canView,
      canCreate,
      canEdit,
      canDelete
    });
  } catch (error) {
    console.error("RBAC permissions error:", error);
    return Response.json({ error: "Failed to load permissions" }, { status: 500 });
  }
}

