// Application route/page/API handler for this feature area.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Client helper: returns booleans canView / canCreate / canEdit / canDelete for one module key
 * so the UI can show or hide actions without embedding permission rules in the browser.
 */
import { modules } from "../../../../config/modules";
import { getSessionUser } from "../../../../lib/session";
import { hasModulePermission } from "../../../../lib/rbac";
import { jsonApiErrorForAction, jsonUnauthorizedForSession } from "../../../../lib/apiErrorResponse";
import { cookies } from "next/headers";

// Tell the UI which buttons to show (view/create/edit/delete) for one module.
export async function GET(req, { params }) {
  try {
    // The client calls this route to decide which buttons to show (edit/delete/etc).
    const cookieStore = await cookies();
    const sid = cookieStore.get("session")?.value;
    const user = await getSessionUser(sid);

    if (!user) {
      return await jsonUnauthorizedForSession(sid);
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
      canDelete,
      // Session context for module-specific UI (e.g. default unit for normal users).
      role: user.role != null ? Number(user.role) : null,
      unit: user.unit != null && String(user.unit).trim() !== "" ? user.unit : null
    });
  } catch (error) {
    return jsonApiErrorForAction(error, "loadPermissions", { logLabel: "RBAC permissions" });
  }
}


