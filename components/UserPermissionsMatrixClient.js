"use client";

/**
 * Matrix editor: per module — Add first, then View/Edit/Delete with Own | Unit | All scopes.
 */
import { useCallback, useEffect, useState } from "react";
import LoadingOverlay from "./LoadingOverlay";
import ToastNotice from "./ToastNotice";

const COL_LABELS = {
  can_view: "View",
  can_create: "Add",
  can_edit: "Edit",
  can_delete: "Delete"
};

/** DB scope values for middle column (stored as `unit`) */
const SCOPE_TRIPLE = [
  { key: "own", label: "Own" },
  { key: "unit", label: "Unit" },
  { key: "all", label: "All" }
];

/** @param {'view'|'edit'|'delete'} action */
function flagForAction(action) {
  if (action === "view") return "can_view";
  if (action === "edit") return "can_edit";
  return "can_delete";
}

/** @param {'view'|'edit'|'delete'} action */
function scopeFieldForAction(action) {
  return `${action}_scope`;
}

/**
 * @param {{ isActive?: boolean }} props
 */
export default function UserPermissionsMatrixClient({ isActive = true }) {
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [permissions, setPermissions] = useState({
    canView: false,
    canCreate: false,
    canEdit: false,
    canDelete: false
  });

  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [selectedUserRole, setSelectedUserRole] = useState(null);

  const [matrixRows, setMatrixRows] = useState([]);
  const [strayDbRows, setStrayDbRows] = useState(0);
  const [dirty, setDirty] = useState(false);

  const title = "User Permissions";

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  function showToast(kind, message) {
    setToast({ kind, message: String(message || "") });
  }

  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/permissions/user_permissions");
        const text = await res.text();
        const payload = text ? JSON.parse(text) : null;
        if (!res.ok) throw new Error(payload?.error || "Failed to load permissions");
        if (!cancelled && payload) {
          setPermissions({
            canView: Boolean(payload.canView),
            canCreate: Boolean(payload.canCreate),
            canEdit: Boolean(payload.canEdit),
            canDelete: Boolean(payload.canDelete)
          });
        }
      } catch {
        setPermissions({ canView: false, canCreate: false, canEdit: false, canDelete: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isActive]);

  const loadUsers = useCallback(async () => {
    setBusy(true);
    try {
      const q = new URLSearchParams({
        page: "1",
        limit: "500",
        sortBy: "fullName",
        sortDir: "asc"
      });
      const res = await fetch(`/api/crud/users?${q}`);
      const text = await res.text();
      const payload = text ? JSON.parse(text) : null;
      if (!res.ok) throw new Error(payload?.error || "Failed to load users");
      const list = Array.isArray(payload?.data) ? payload.data : [];
      setUsers(list);
    } catch (e) {
      showToast("error", e.message || "Failed to load users");
    } finally {
      setBusy(false);
    }
  }, []);

  const loadMatrix = useCallback(async (uid) => {
    if (!uid) {
      setMatrixRows([]);
      setStrayDbRows(0);
      setDirty(false);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/user-permissions-matrix?userId=${encodeURIComponent(uid)}`);
      const text = await res.text();
      const payload = text ? JSON.parse(text) : null;
      if (!res.ok) throw new Error(payload?.error || "Failed to load matrix");
      setMatrixRows(Array.isArray(payload?.rows) ? payload.rows : []);
      setStrayDbRows(Number(payload?.strayDbRows) || 0);
      setDirty(false);
    } catch (e) {
      showToast("error", e.message || "Failed to load matrix");
      setMatrixRows([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    loadUsers();
  }, [isActive, loadUsers]);

  useEffect(() => {
    if (!isActive) return;
    if (!userId) {
      setMatrixRows([]);
      setStrayDbRows(0);
      setDirty(false);
      return;
    }
    loadMatrix(userId);
  }, [isActive, userId, loadMatrix]);

  const canSave = permissions.canEdit || permissions.canCreate;

  /**
   * Toggle scope for view|edit|delete: same scope click turns off that right; new scope selects it.
   * @param {'view'|'edit'|'delete'} action
   * @param {'own'|'unit'|'all'} scopeKey
   */
  function updateActionScope(moduleKey, action, scopeKey) {
    const sf = scopeFieldForAction(action);
    const fk = flagForAction(action);
    setMatrixRows((prev) =>
      prev.map((r) => {
        if (r.module !== moduleKey) return r;
        const cur = r[sf];
        if (cur === scopeKey && r[fk]) {
          return { ...r, [sf]: "all", [fk]: false };
        }
        return { ...r, [sf]: scopeKey, [fk]: true };
      })
    );
    setDirty(true);
  }

  function scopeCheckboxChecked(row, action, scopeKey) {
    const fk = flagForAction(action);
    const sf = scopeFieldForAction(action);
    return Boolean(row[fk] && row[sf] === scopeKey);
  }

  function updateCell(moduleKey, permKey, checked) {
    setMatrixRows((prev) =>
      prev.map((r) => (r.module === moduleKey ? { ...r, [permKey]: Boolean(checked) } : r))
    );
    setDirty(true);
  }

  function checkAllMatrix(value) {
    setMatrixRows((prev) =>
      prev.map((r) => ({
        ...r,
        can_view: value,
        can_create: value,
        can_edit: value,
        can_delete: value,
        view_scope: "all",
        edit_scope: "all",
        delete_scope: "all"
      }))
    );
    setDirty(true);
  }

  function renderScopeCells(row, action) {
    return SCOPE_TRIPLE.map(({ key, label }, i) => (
      <td
        key={`${row.module}-${action}-${key}`}
        className={
          i === 0
            ? "perm-matrix-cb perm-matrix-divider-left"
            : "perm-matrix-cb perm-matrix-col-inner"
        }
      >
        <input
          type="checkbox"
          checked={scopeCheckboxChecked(row, action, key)}
          onChange={() => updateActionScope(row.module, action, key)}
          title={`${COL_LABELS[flagForAction(action)]}: ${label}`}
          aria-label={`${label} scope for ${action} — ${row.label}`}
        />
      </td>
    ));
  }

  function renderMatrixBody() {
    const nodes = [];
    let lastGroup = null;
    for (const row of matrixRows) {
      if (row.group !== lastGroup) {
        lastGroup = row.group;
        nodes.push(
          <tr key={`grp-${String(lastGroup)}-${nodes.length}`} className="perm-matrix-group-row">
            <td colSpan={11} className="perm-matrix-group-cell">
              {row.group || "—"}
            </td>
          </tr>
        );
      }
      nodes.push(
        <tr key={row.module}>
          <td className="perm-matrix-module">
            <span className="perm-matrix-module-label">{row.label}</span>
            <span className="perm-matrix-module-sep" aria-hidden>
              ·
            </span>
            <span className="perm-matrix-module-key muted">{row.module}</span>
          </td>
          <td className="perm-matrix-cb perm-matrix-divider-left">
            <input
              type="checkbox"
              checked={Boolean(row.can_create)}
              onChange={(e) => updateCell(row.module, "can_create", e.target.checked)}
              aria-label={`Add for ${row.label}`}
            />
          </td>
          {renderScopeCells(row, "view")}
          {renderScopeCells(row, "edit")}
          {renderScopeCells(row, "delete")}
        </tr>
      );
    }
    return nodes;
  }

  async function handleSave() {
    if (!userId || !canSave) return;
    setBusy(true);
    try {
      const rows = matrixRows.map((r) => ({
        module: r.module,
        can_view: r.can_view,
        can_create: r.can_create,
        can_edit: r.can_edit,
        can_delete: r.can_delete,
        view_scope: r.view_scope,
        edit_scope: r.edit_scope,
        delete_scope: r.delete_scope
      }));
      const res = await fetch("/api/user-permissions-matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: Number(userId), rows })
      });
      const text = await res.text();
      const payload = text ? JSON.parse(text) : null;
      if (!res.ok) throw new Error(payload?.error || "Save failed");
      showToast("success", "Permissions saved.");
      setDirty(false);
      await loadMatrix(userId);
    } catch (e) {
      showToast("error", e.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function onUserChange(e) {
    const v = e.target.value;
    setUserId(v);
    const u = users.find((x) => String(x.id) === String(v));
    setSelectedUserRole(u != null ? Number(u.role) : null);
  }

  return (
    <div className="master-module-page">
      <LoadingOverlay busy={busy} />
      <ToastNotice toast={toast} onClose={() => setToast(null)} />

      <div className="master-module-header perm-matrix-page-header">
        <div>
          <h1 className="module-page-title">{title}</h1>
          <p className="muted master-module-sub perm-matrix-lead">
            Columns: <strong>Add</strong> first, then <strong>View</strong> / <strong>Edit</strong> / <strong>Delete</strong>{" "}
            with scope <strong>Own</strong> | <strong>Unit</strong> | <strong>All</strong>. Use{" "}
            <strong>Check all</strong> / <strong>Uncheck all</strong> above the table only if you intend to set every
            module at once. Requires <code>user_permissions.view_scope</code>, <code>edit_scope</code>,{" "}
            <code>delete_scope</code> and <code>users.unit</code> where relevant.
          </p>
        </div>
      </div>

      {!permissions.canView ? (
        <div className="card error-text">You do not have permission to view User Permissions.</div>
      ) : (
        <div className="card perm-matrix-card">
          <div className="perm-matrix-top">
            <div className="perm-matrix-user-row">
              <label className="perm-matrix-user-label" htmlFor="perm-matrix-user-select">
                User
              </label>
              <select
                id="perm-matrix-user-select"
                className="perm-matrix-user-select"
                value={userId}
                onChange={onUserChange}
                disabled={busy}
              >
                <option value="">— Select user —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName || u.email || `User #${u.id}`}
                  </option>
                ))}
              </select>
            </div>
            {userId && matrixRows.length > 0 ? (
              <div className="perm-matrix-bulk">
                <button
                  type="button"
                  className="master-btn master-btn-outline master-btn-sm"
                  onClick={() => checkAllMatrix(true)}
                  disabled={busy}
                >
                  Check all
                </button>
                <button
                  type="button"
                  className="master-btn master-btn-outline master-btn-sm"
                  onClick={() => checkAllMatrix(false)}
                  disabled={busy}
                >
                  Uncheck all
                </button>
              </div>
            ) : null}
          </div>

          {Number(selectedUserRole) === 1 ? (
            <p className="perm-matrix-admin-note">
              <strong>Role 1 (admin):</strong> full access is always granted; this matrix applies if you change their role
              later.
            </p>
          ) : null}

          {strayDbRows > 0 ? (
            <p className="perm-matrix-stray muted">
              {strayDbRows} DB row(s) reference unknown module keys (not in <code>config/modules.js</code>).
            </p>
          ) : null}

          {userId && matrixRows.length > 0 ? (
            <div className="perm-matrix-scroll">
              <table className="perm-matrix-table">
                <colgroup>
                  <col className="perm-matrix-col-module" />
                  <col className="perm-matrix-col-add" />
                  <col className="perm-matrix-col-scope" />
                  <col className="perm-matrix-col-scope" />
                  <col className="perm-matrix-col-scope" />
                  <col className="perm-matrix-col-scope" />
                  <col className="perm-matrix-col-scope" />
                  <col className="perm-matrix-col-scope" />
                  <col className="perm-matrix-col-scope" />
                  <col className="perm-matrix-col-scope" />
                  <col className="perm-matrix-col-scope" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="perm-matrix-th-module" rowSpan={2} scope="col">
                      Module
                    </th>
                    <th className="perm-matrix-th-narrow perm-matrix-divider-left" rowSpan={2} scope="col">
                      <div className="perm-matrix-th-headgroup perm-matrix-th-headgroup--label-only">
                        <span>Add</span>
                      </div>
                    </th>
                    <th colSpan={3} className="perm-matrix-th-group perm-matrix-divider-left" scope="colgroup">
                      <div className="perm-matrix-th-headgroup perm-matrix-th-headgroup--label-only">
                        <span>View</span>
                      </div>
                    </th>
                    <th colSpan={3} className="perm-matrix-th-group perm-matrix-divider-left" scope="colgroup">
                      <div className="perm-matrix-th-headgroup perm-matrix-th-headgroup--label-only">
                        <span>Edit</span>
                      </div>
                    </th>
                    <th colSpan={3} className="perm-matrix-th-group perm-matrix-divider-left" scope="colgroup">
                      <div className="perm-matrix-th-headgroup perm-matrix-th-headgroup--label-only">
                        <span>Delete</span>
                      </div>
                    </th>
                  </tr>
                  <tr className="perm-matrix-th-sub">
                    <th className="perm-matrix-th-scope perm-matrix-divider-left" scope="col">
                      Own
                    </th>
                    <th className="perm-matrix-th-scope perm-matrix-col-inner" scope="col">
                      Unit
                    </th>
                    <th className="perm-matrix-th-scope perm-matrix-col-inner" scope="col">
                      All
                    </th>
                    <th className="perm-matrix-th-scope perm-matrix-divider-left" scope="col">
                      Own
                    </th>
                    <th className="perm-matrix-th-scope perm-matrix-col-inner" scope="col">
                      Unit
                    </th>
                    <th className="perm-matrix-th-scope perm-matrix-col-inner" scope="col">
                      All
                    </th>
                    <th className="perm-matrix-th-scope perm-matrix-divider-left" scope="col">
                      Own
                    </th>
                    <th className="perm-matrix-th-scope perm-matrix-col-inner" scope="col">
                      Unit
                    </th>
                    <th className="perm-matrix-th-scope perm-matrix-col-inner" scope="col">
                      All
                    </th>
                  </tr>
                </thead>
                <tbody>{renderMatrixBody()}</tbody>
              </table>
            </div>
          ) : null}

          {userId && matrixRows.length === 0 && !busy ? (
            <p className="muted perm-matrix-hint">Could not load the permission matrix.</p>
          ) : null}

          {!userId ? <p className="muted perm-matrix-hint">Choose a user to load and edit rights.</p> : null}

          {userId ? (
            <div className="perm-matrix-footer">
              <div className="perm-matrix-footer-meta">
                {dirty && canSave ? <span className="perm-matrix-unsaved">Unsaved changes</span> : null}
                {!canSave ? (
                  <span className="muted">View only — you cannot save (no create/edit on User Permissions).</span>
                ) : null}
              </div>
              <div className="perm-matrix-footer-actions">
                {canSave ? (
                  <button
                    type="button"
                    className="master-btn master-btn-primary"
                    onClick={handleSave}
                    disabled={busy || !dirty}
                  >
                    Save permissions
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
