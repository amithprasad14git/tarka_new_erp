// Application route/page/API handler for this feature area.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Load and save per-user module rights: can_* flags + view_scope / edit_scope / delete_scope (own|unit|all).
 * POST { userId, rows } — replace rows for matrix module keys.
 */
import { requireRequestUser } from "../../../../lib/requestSession";
import pool from "../../../../lib/db";
import { actionScopesFromDbRow, normalizeActionScope } from "../../../../lib/permissionScope";
import { getRbacMatrixModuleEntries, getRbacMatrixModuleKeySet } from "../../../../lib/rbacMatrixModules";
import { isReportKey } from "../../../../lib/reportConfig";
import { isDashboardPermissionKey } from "../../../../lib/dashboardConfig";
import { hasModulePermission } from "../../../../lib/rbac";
import { escapeSqlTableId } from "../../../../lib/sqlModuleTable";
import { formatInstantAsMysqlDatetimeIST } from "../../../../lib/istDateTime";
import { assertUserPermissionsTargetUserIsActive } from "../../../../lib/modules/userPermissions";
import { jsonApiErrorForAction } from "../../../../lib/apiErrorResponse";

const COLS = ["can_view", "can_create", "can_edit", "can_delete"];

// Read ?userId= from query string; invalid values become null.
function parseUserId(url) {
  const raw = url.searchParams.get("userId");
  if (raw == null || raw === "") return null;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Fetch existing permission rows for one user from user_permissions table.
async function loadPermRowsForUser(userId) {
  const pt = escapeSqlTableId("user_permissions");
  const [rows] = await pool.query(
    `SELECT id, module, can_view, can_create, can_edit, can_delete,
            view_scope, edit_scope, delete_scope
     FROM ${pt} WHERE user_id = ?`,
    [userId]
  );
  return rows || [];
}

/**
 * GET /api/user-permissions-matrix — load the permissions matrix for a selected user.
 */
// Load the full RBAC matrix for one target user (for the permissions admin screen).
export async function GET(req) {
  try {
    const auth = await requireRequestUser(req);
    if (auth.unauthorized) return auth.unauthorized;
    const user = auth.user;

    const canView = await hasModulePermission(user, "user_permissions", "view");
    if (!canView) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const userId = parseUserId(url);
    if (!userId) {
      return Response.json({ error: "userId required" }, { status: 400 });
    }

    const matrixModules = getRbacMatrixModuleEntries();
    const keySet = getRbacMatrixModuleKeySet();

    // Existing DB rows for this user (may include stale modules from old configs).
    const permRows = await loadPermRowsForUser(userId);

    const byModule = Object.fromEntries(
      (permRows || []).map((r) => {
        const scopes = actionScopesFromDbRow(r);
        return [
          String(r.module),
          {
            id: r.id,
            can_view: Boolean(Number(r.can_view)),
            can_create: Boolean(Number(r.can_create)),
            can_edit: Boolean(Number(r.can_edit)),
            can_delete: Boolean(Number(r.can_delete)),
            view_scope: scopes.view_scope,
            edit_scope: scopes.edit_scope,
            delete_scope: scopes.delete_scope
          }
        ];
      })
    );

    // Defaults keep UI deterministic when permission row does not exist for a module key yet.
    const defaults = { view_scope: "all", edit_scope: "all", delete_scope: "all" };
    const rows = matrixModules.map(({ key, label, group, isReport, isDashboard }) => {
      const existing = byModule[key];
      return {
        module: key,
        label,
        group,
        isReport: Boolean(isReport),
        isDashboard: Boolean(isDashboard),
        id: existing?.id ?? null,
        can_view: existing?.can_view ?? false,
        can_create: existing?.can_create ?? false,
        can_edit: existing?.can_edit ?? false,
        can_delete: existing?.can_delete ?? false,
        view_scope: existing?.view_scope ?? defaults.view_scope,
        edit_scope: existing?.edit_scope ?? defaults.edit_scope,
        delete_scope: existing?.delete_scope ?? defaults.delete_scope
      };
    });

    return Response.json({
      userId,
      matrixModules,
      rows,
      strayDbRows: (permRows || []).filter((r) => !keySet.has(String(r.module))).length
    });
  } catch (error) {
    return jsonApiErrorForAction(error, "loadMatrix", { logLabel: "user-permissions-matrix GET" });
  }
}

/**
 * POST /api/user-permissions-matrix — save the permissions matrix for a selected user.
 */
// Save the full permission matrix for one user (replace matrix-managed module rows).
export async function POST(req) {
  try {
    const auth = await requireRequestUser(req);
    if (auth.unauthorized) return auth.unauthorized;
    const user = auth.user;

    const canEdit = await hasModulePermission(user, "user_permissions", "edit");
    const canCreate = await hasModulePermission(user, "user_permissions", "create");
    if (!canEdit && !canCreate) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const userId = body && parseInt(String(body.userId), 10);
    const incoming = body && Array.isArray(body.rows) ? body.rows : null;

    if (!Number.isFinite(userId) || userId <= 0 || !incoming) {
      return Response.json({ error: "Invalid body (need userId, rows[])" }, { status: 400 });
    }

    try {
      await assertUserPermissionsTargetUserIsActive(pool, userId);
    } catch (e) {
      if (e?.code === "USER_PERMISSIONS_VALIDATION_FAILED") {
        return Response.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    const allowed = getRbacMatrixModuleKeySet();
    // Normalize incoming rows and enforce "exactly one row per known module key".
    const byKey = new Map();
    for (const r of incoming) {
      const mod = String(r?.module ?? "").trim();
      if (!mod || !allowed.has(mod)) continue;
      if (byKey.has(mod)) {
        return Response.json({ error: `Duplicate module in rows: ${mod}` }, { status: 400 });
      }
      if (isReportKey(mod) || isDashboardPermissionKey(mod)) {
        byKey.set(mod, {
          module: mod,
          can_view: Boolean(r?.can_view),
          can_create: false,
          can_edit: false,
          can_delete: false,
          view_scope: "all",
          edit_scope: "all",
          delete_scope: "all"
        });
      } else {
        byKey.set(mod, {
          module: mod,
          can_view: Boolean(r?.can_view),
          can_create: Boolean(r?.can_create),
          can_edit: Boolean(r?.can_edit),
          can_delete: Boolean(r?.can_delete),
          view_scope: normalizeActionScope(r?.view_scope),
          edit_scope: normalizeActionScope(r?.edit_scope),
          delete_scope: normalizeActionScope(r?.delete_scope)
        });
      }
    }
    if (byKey.size !== allowed.size) {
      return Response.json({ error: "rows must include every module key exactly once" }, { status: 400 });
    }
    const normalized = [...byKey.values()];

    const modKeys = [...allowed];
    const placeholders = modKeys.map(() => "?").join(",");

    const conn = await pool.getConnection();
    const pt = escapeSqlTableId("user_permissions");
    try {
      await conn.beginTransaction();

      // Replace only matrix-managed module rows, keep unrelated permission rows untouched.
      await conn.query(
        `DELETE FROM ${pt} WHERE user_id = ? AND module IN (${placeholders})`,
        [userId, ...modKeys]
      );

      const now = formatInstantAsMysqlDatetimeIST();
      const actorId = user.id;

      for (const r of normalized) {
        // Skip fully disabled module rows (no need to store all-zero rows in DB).
        const any = r.can_view || r.can_create || r.can_edit || r.can_delete;
        if (!any) continue;

        const vals = COLS.map((c) => (r[c] ? 1 : 0));
        const vs = normalizeActionScope(r.view_scope);
        const es = normalizeActionScope(r.edit_scope);
        const ds = normalizeActionScope(r.delete_scope);

        await conn.query(
          `INSERT INTO ${pt} (user_id, module, ${COLS.join(
            ", "
          )}, view_scope, edit_scope, delete_scope, createdBy, createdDate, modifiedBy, modifiedDate)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            userId,
            r.module,
            ...vals,
            vs,
            es,
            ds,
            actorId,
            now,
            actorId,
            now
          ]
        );
      }

      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    return Response.json({ ok: true, userId });
  } catch (error) {
    if (error?.code === "USER_PERMISSIONS_VALIDATION_FAILED") {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return jsonApiErrorForAction(error, "savePermissions", { logLabel: "user-permissions-matrix POST" });
  }
}

