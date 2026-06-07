// Application route/page/API handler for this feature area.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * =============================================================================
 * CRUD BY RECORD ID — `/api/crud/<module>/<id>`
 * =============================================================================
 * Loads (HTTP GET), updates (HTTP PUT), or deletes (HTTP DELETE) **one** row identified by its primary
 * key `id` in the URL. The module name must match config/modules.js.
 *
 * These handlers stay intentionally thin: they only
 *   - figure out who is logged in (session cookie),
 *   - read URL parameters (module, id),
 *   - for PUT, pass a **callback** that reads JSON so the body is not consumed until
 *     the service has confirmed the user may edit this row (see crud.service.js),
 *   - map the service result to an HTTP response.
 *
 * All permission checks, validation, SQL, and audit logging happen in the service.
 *
 * Typical JSON responses:
 * - GET success: `{ data: <parent row>, childTableRows?: { ... } }` with status 200.
 * - Success update/delete: `{ ok: true }` with status 200.
 * - Errors: `{ error: "..." }` with 400/401/403/404 as appropriate.
 * - Unexpected server failure: 500 with a generic message; details only in server logs.
 * =============================================================================
 */
import { cookies } from "next/headers";
import { getSessionUser } from "../../../../../lib/session";
import { deleteCrudRecord, getCrudRecordById, updateCrudRecord } from "../../../../../lib/services/crud.service";

/** Same as the list route: cookie → session id → user object or null. */
async function getRequestUser() {
  const cookieStore = await cookies();
  const sid = cookieStore.get("session")?.value;
  return getSessionUser(sid);
}

/**
 * GET — load one parent row (and configured child tables) for the entry form.
 */
// Load one record (and child tables) for view/edit form.
export async function GET(req, { params }) {
  try {
    const user = await getRequestUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { module, id } = await params;
    const result = await getCrudRecordById(user, module, id);
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    console.error("CRUD GET by id error:", error);
    return Response.json({ error: "Failed to load record" }, { status: 500 });
  }
}

/**
 * PUT — save changes to an existing row.
 *
 * Order of work inside the service (not here): module valid → not read-only → user can edit
 * module → row exists → row scope allows this row → **then** req.json() runs via callback →
 * validate → update DB → audit log.
 */
// Update existing row; JSON body is read only after edit permission passes in service.
export async function PUT(req, { params }) {
  try {
    const user = await getRequestUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { module, id } = await params;
    const result = await updateCrudRecord(user, module, id, () => req.json());
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    console.error("CRUD PUT error:", error);
    return Response.json({ error: "Failed to update record" }, { status: 500 });
  }
}

/**
 * DELETE — remove one row permanently (after permission and scope checks in the service).
 * No request body is read.
 */
// Permanently delete one row after permission and row-scope checks in service.
export async function DELETE(req, { params }) {
  try {
    const user = await getRequestUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { module, id } = await params;
    const result = await deleteCrudRecord(user, module, id);
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    console.error("CRUD DELETE error:", error);
    return Response.json({ error: "Failed to delete record" }, { status: 500 });
  }
}

