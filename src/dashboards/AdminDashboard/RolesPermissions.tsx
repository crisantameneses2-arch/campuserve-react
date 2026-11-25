import { useCallback, useEffect, useState } from "react";

import "./RolesPermissions.css";

import {
  ADMIN_LOCKED_PERMISSIONS,
  ADMIN_ROLE_KEY,
  ALL_PERMISSION_KEYS,
  PERMISSIONS,
} from "../../constants/permissions";

import {
  countUsersByRole,
  createRole,
  deleteRole,
  fetchRoles,
  saveRoleDetails,
  savePermissions,
  type RoleActor,
  type RoleRecord,
} from "../../services/roles";

type RolesPermissionsProps = {
  actor: RoleActor;
  /** Called after any change so the sidebar can refresh. */
  onRolesChanged?: () => void;
};

type Banner = {
  type: "success" | "error";
  text: string;
} | null;

type ModalState =
  | { mode: "create" }
  | { mode: "edit"; roleKey: string }
  | null;

function sameSet(a: string[], b: string[]) {
  return (
    a.length === b.length && a.every((item) => b.includes(item))
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message
    ? error.message
    : fallback;
}

function RolesPermissions({
  actor,
  onRolesChanged,
}: RolesPermissionsProps) {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [userCounts, setUserCounts] = useState<
    Record<string, number>
  >({});

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedKey, setSelectedKey] = useState("");
  const [draft, setDraft] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [banner, setBanner] = useState<Banner>(null);

  const [modal, setModal] = useState<ModalState>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [modalBusy, setModalBusy] = useState(false);

  /* =====================================================
     LOAD
  ===================================================== */

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const [loadedRoles, counts] = await Promise.all([
        fetchRoles(),
        countUsersByRole(),
      ]);

      setRoles(loadedRoles);
      setUserCounts(counts);

      const first =
        loadedRoles.find(
          (role) => role.key === ADMIN_ROLE_KEY
        ) || loadedRoles[0];

      if (first) {
        setSelectedKey(first.key);
        setDraft(first.permissions);
      }
    } catch (error) {
      console.error("Error loading roles:", error);
      setLoadError(
        errorMessage(error, "Could not load roles.")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* =====================================================
     DERIVED VALUES
  ===================================================== */

  const selectedRole = roles.find(
    (role) => role.key === selectedKey
  );

  const isDirty =
    !!selectedRole && !sameSet(draft, selectedRole.permissions);

  const totalUsers = Object.values(userCounts).reduce(
    (sum, count) => sum + count,
    0
  );

  const customRoleCount = roles.filter(
    (role) => !role.isSystem
  ).length;

  const lockedKeys =
    selectedKey === ADMIN_ROLE_KEY
      ? ADMIN_LOCKED_PERMISSIONS
      : [];

  const editingRole =
    modal?.mode === "edit"
      ? roles.find((role) => role.key === modal.roleKey)
      : undefined;

  /* =====================================================
     PERMISSION ACTIONS
  ===================================================== */

  const handleSelectRole = (role: RoleRecord) => {
    if (role.key === selectedKey) return;

    if (
      isDirty &&
      !window.confirm(
        "You have unsaved permission changes. Discard them?"
      )
    ) {
      return;
    }

    setSelectedKey(role.key);
    setDraft(role.permissions);
    setBanner(null);
  };

  const togglePermission = (key: string) => {
    if (lockedKeys.includes(key)) return;

    setDraft((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    );
  };

  const selectAll = () => setDraft(ALL_PERMISSION_KEYS);

  const clearAll = () => setDraft([...lockedKeys]);

  const handleSavePermissions = async () => {
    if (!selectedRole || !isDirty) return;

    setSaving(true);
    setBanner(null);

    try {
      const saved = await savePermissions(
        selectedRole,
        draft,
        actor
      );

      setRoles((current) =>
        current.map((role) =>
          role.key === selectedRole.key
            ? { ...role, permissions: saved }
            : role
        )
      );

      setDraft(saved);

      setBanner({
        type: "success",
        text: `Permissions saved for ${selectedRole.name}.`,
      });

      onRolesChanged?.();
    } catch (error) {
      console.error("Error saving permissions:", error);
      setBanner({
        type: "error",
        text: errorMessage(
          error,
          "Could not save permissions."
        ),
      });
    } finally {
      setSaving(false);
    }
  };

  /* =====================================================
     CREATE / EDIT / DELETE ROLE
  ===================================================== */

  const openCreate = () => {
    setFormName("");
    setFormDescription("");
    setFormError("");
    setModal({ mode: "create" });
  };

  const openEdit = (role: RoleRecord) => {
    setFormName(role.name);
    setFormDescription(role.description);
    setFormError("");
    setModal({ mode: "edit", roleKey: role.key });
  };

  const closeModal = () => {
    if (modalBusy) return;
    setModal(null);
  };

  const handleSubmitModal = async () => {
    if (!modal) return;

    setModalBusy(true);
    setFormError("");

    try {
      if (modal.mode === "create") {
        const created = await createRole(
          { name: formName, description: formDescription },
          roles,
          actor
        );

        setRoles((current) => [...current, created]);

        if (
          !isDirty ||
          window.confirm(
            "You have unsaved permission changes. Discard them?"
          )
        ) {
          setSelectedKey(created.key);
          setDraft(created.permissions);
        }

        setBanner({
          type: "success",
          text: `${created.name} role created. Select permissions for it and save.`,
        });
      } else if (editingRole) {
        const updated = await saveRoleDetails(
          editingRole,
          { name: formName, description: formDescription },
          actor
        );

        setRoles((current) =>
          current.map((role) =>
            role.key === updated.key ? updated : role
          )
        );

        setBanner({
          type: "success",
          text: `${updated.name} role updated.`,
        });
      }

      setModal(null);
      onRolesChanged?.();
    } catch (error) {
      console.error("Error saving role:", error);
      setFormError(
        errorMessage(error, "Could not save the role.")
      );
    } finally {
      setModalBusy(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!editingRole) return;

    if (
      !window.confirm(
        `Delete the "${editingRole.name}" role? This cannot be undone.`
      )
    ) {
      return;
    }

    setModalBusy(true);
    setFormError("");

    try {
      await deleteRole(editingRole, actor);

      const remaining = roles.filter(
        (role) => role.key !== editingRole.key
      );

      setRoles(remaining);

      if (selectedKey === editingRole.key) {
        const next =
          remaining.find(
            (role) => role.key === ADMIN_ROLE_KEY
          ) || remaining[0];

        setSelectedKey(next?.key || "");
        setDraft(next?.permissions || []);
      }

      setBanner({
        type: "success",
        text: `${editingRole.name} role deleted.`,
      });

      setModal(null);
      onRolesChanged?.();
    } catch (error) {
      console.error("Error deleting role:", error);
      setFormError(
        errorMessage(error, "Could not delete the role.")
      );
    } finally {
      setModalBusy(false);
    }
  };

  /* =====================================================
     RENDER
  ===================================================== */

  if (loading) {
    return (
      <div className="roles-page">
        <p className="roles-state">Loading roles…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="roles-page">
        <div className="roles-banner roles-banner-error">
          {loadError}
        </div>

        <button
          type="button"
          className="roles-primary-button"
          onClick={loadData}
        >
          Try again
        </button>
      </div>
    );
  }

  const editingUsers = editingRole
    ? userCounts[editingRole.key] || 0
    : 0;

  return (
    <div className="roles-page">
      <div className="roles-header">
        <div>
          <h1>Roles & Permissions</h1>
          <p>Manage system roles and access permissions.</p>
        </div>

        <button
          type="button"
          className="roles-primary-button"
          onClick={openCreate}
        >
          + Create Role
        </button>
      </div>

      {banner && (
        <div
          className={`roles-banner roles-banner-${banner.type}`}
          role={banner.type === "error" ? "alert" : "status"}
        >
          <span>{banner.text}</span>

          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setBanner(null)}
          >
            ×
          </button>
        </div>
      )}

      <div className="roles-summary">
        <div className="roles-summary-card">
          <span>Total Roles</span>
          <strong>{roles.length}</strong>
        </div>

        <div className="roles-summary-card">
          <span>Total Users</span>
          <strong>{totalUsers}</strong>
        </div>

        <div className="roles-summary-card">
          <span>Custom Roles</span>
          <strong>{customRoleCount}</strong>
        </div>
      </div>

      <div className="roles-content">
        <div className="roles-list-card">
          <div className="roles-card-header">
            <div>
              <h2>System Roles</h2>
              <p>Select a role to view and change its permissions.</p>
            </div>
          </div>

          <div className="roles-list">
            {roles.map((role) => (
              <div
                className={`role-item ${
                  role.key === selectedKey
                    ? "role-item-selected"
                    : ""
                }`}
                key={role.key}
              >
                <button
                  type="button"
                  className="role-select"
                  onClick={() => handleSelectRole(role)}
                  aria-pressed={role.key === selectedKey}
                >
                  <div className="role-icon">
                    {role.name.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <h3>{role.name}</h3>
                    <p>{role.description || "No description"}</p>
                  </div>
                </button>

                <div className="role-users">
                  <strong>{userCounts[role.key] || 0}</strong>
                  <span>
                    {(userCounts[role.key] || 0) === 1
                      ? "user"
                      : "users"}
                  </span>
                </div>

                <span
                  className={`role-status ${
                    role.isSystem ? "" : "role-status-custom"
                  }`}
                >
                  {role.isSystem ? "System" : "Custom"}
                </span>

                <button
                  type="button"
                  className="role-edit-button"
                  onClick={() => openEdit(role)}
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="permissions-card">
          <div className="roles-card-header">
            <div>
              <h2>
                {selectedRole
                  ? `${selectedRole.name} Permissions`
                  : "Permissions"}
              </h2>
              <p>Sections of the admin console this role can open.</p>
            </div>
          </div>

          {selectedRole ? (
            <>
              <div className="permissions-tools">
                <button type="button" onClick={selectAll}>
                  Select all
                </button>
                <button type="button" onClick={clearAll}>
                  Clear
                </button>
              </div>

              <div className="permissions-list">
                {PERMISSIONS.map((permission) => {
                  const locked = lockedKeys.includes(
                    permission.key
                  );

                  return (
                    <label
                      className="permission-item"
                      key={permission.key}
                    >
                      <input
                        type="checkbox"
                        checked={draft.includes(permission.key)}
                        disabled={locked}
                        onChange={() =>
                          togglePermission(permission.key)
                        }
                      />

                      <span className="permission-text">
                        {permission.label}
                        <small>{permission.description}</small>
                      </span>

                      {locked && (
                        <span className="permission-locked">
                          Required
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>

              <button
                type="button"
                className="roles-save-button"
                onClick={handleSavePermissions}
                disabled={!isDirty || saving}
              >
                {saving
                  ? "Saving…"
                  : isDirty
                  ? "Save Permissions"
                  : "No changes to save"}
              </button>
            </>
          ) : (
            <p className="roles-state">No role selected.</p>
          )}
        </div>
      </div>

      {modal && (
        <div
          className="roles-modal-backdrop"
          onClick={closeModal}
          onKeyDown={(event) => {
            if (event.key === "Escape") closeModal();
          }}
        >
          <div
            className="roles-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="roles-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="roles-modal-title">
              {modal.mode === "create"
                ? "Create Role"
                : `Edit ${editingRole?.name || "Role"}`}
            </h2>

            <label className="roles-field">
              <span>Role name</span>
              <input
                type="text"
                value={formName}
                maxLength={40}
                autoFocus
                onChange={(event) =>
                  setFormName(event.target.value)
                }
                placeholder="e.g. Librarian"
              />
            </label>

            <label className="roles-field">
              <span>Description</span>
              <textarea
                value={formDescription}
                maxLength={120}
                rows={3}
                onChange={(event) =>
                  setFormDescription(event.target.value)
                }
                placeholder="What is this role responsible for?"
              />
            </label>

            {formError && (
              <p className="roles-form-error" role="alert">
                {formError}
              </p>
            )}

            <div className="roles-modal-actions">
              {modal.mode === "edit" &&
                editingRole &&
                !editingRole.isSystem && (
                  <button
                    type="button"
                    className="roles-danger-button"
                    onClick={handleDeleteRole}
                    disabled={modalBusy || editingUsers > 0}
                    title={
                      editingUsers > 0
                        ? "Move this role's users to another role first."
                        : undefined
                    }
                  >
                    Delete role
                  </button>
                )}

              <span className="roles-modal-spacer" />

              <button
                type="button"
                className="roles-secondary-button"
                onClick={closeModal}
                disabled={modalBusy}
              >
                Cancel
              </button>

              <button
                type="button"
                className="roles-primary-button"
                onClick={handleSubmitModal}
                disabled={modalBusy || !formName.trim()}
              >
                {modalBusy
                  ? "Saving…"
                  : modal.mode === "create"
                  ? "Create role"
                  : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RolesPermissions;
