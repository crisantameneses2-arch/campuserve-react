import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "../../firebase";

import {
  ADMIN_LOCKED_PERMISSIONS,
  ADMIN_ROLE_KEY,
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLES,
} from "../constants/permissions";

/* =====================================================
   TYPES
===================================================== */

export type RoleRecord = {
  /** Firestore document id. Matches `accounts.role`. */
  key: string;
  name: string;
  description: string;
  permissions: string[];
  /** Built-in roles cannot be deleted. */
  isSystem: boolean;
};

export type RoleActor = {
  id?: string;
  name?: string;
};

/* =====================================================
   HELPERS
===================================================== */

/**
 * Keeps only known permission keys (in a stable order) and makes
 * sure the Administrator role keeps its locked permissions.
 */
export function sanitizePermissions(
  roleKey: string,
  permissions: unknown
): string[] {
  const requested = Array.isArray(permissions)
    ? permissions.filter(
        (item): item is string => typeof item === "string"
      )
    : [];

  return ALL_PERMISSION_KEYS.filter(
    (key) =>
      requested.includes(key) ||
      (roleKey === ADMIN_ROLE_KEY &&
        ADMIN_LOCKED_PERMISSIONS.includes(key))
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Writes an entry to `activityLogs`. Never blocks the main action. */
async function logRoleActivity(
  actor: RoleActor,
  action: string,
  description: string,
  details: Record<string, unknown> = {}
) {
  try {
    await addDoc(collection(db, "activityLogs"), {
      actor_id: actor.id || null,
      actor_name: actor.name || "Administrator",
      actor_role: ADMIN_ROLE_KEY,
      action,
      description,
      request_id: null,
      timestamp: serverTimestamp(),
      details,
    });
  } catch (error) {
    console.error("Could not write activity log:", error);
  }
}

/* =====================================================
   READ
===================================================== */

/**
 * Loads all roles. Any built-in role that is missing from
 * Firestore is created first, so the page works on a fresh database.
 */
export async function fetchRoles(): Promise<RoleRecord[]> {
  const snapshot = await getDocs(collection(db, "roles"));

  const found = new Map<string, RoleRecord>();

  snapshot.forEach((document) => {
    const data = document.data();

    found.set(document.id, {
      key: document.id,
      name:
        typeof data.name === "string" && data.name
          ? data.name
          : document.id,
      description:
        typeof data.description === "string"
          ? data.description
          : "",
      permissions: sanitizePermissions(
        document.id,
        data.permissions
      ),
      isSystem:
        data.isSystem === true ||
        DEFAULT_ROLES.some((role) => role.key === document.id),
    });
  });

  const missing = DEFAULT_ROLES.filter(
    (role) => !found.has(role.key)
  );

  if (missing.length > 0) {
    const batch = writeBatch(db);

    missing.forEach((role) => {
      const permissions = sanitizePermissions(
        role.key,
        role.permissions
      );

      batch.set(doc(db, "roles", role.key), {
        name: role.name,
        description: role.description,
        permissions,
        isSystem: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      found.set(role.key, {
        key: role.key,
        name: role.name,
        description: role.description,
        permissions,
        isSystem: true,
      });
    });

    await batch.commit();
  }

  const defaultOrder = DEFAULT_ROLES.map((role) => role.key);

  return Array.from(found.values()).sort((a, b) => {
    const indexA = defaultOrder.indexOf(a.key);
    const indexB = defaultOrder.indexOf(b.key);

    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;

    return a.name.localeCompare(b.name);
  });
}

/** Number of non-deleted accounts for each role key. */
export async function countUsersByRole(): Promise<
  Record<string, number>
> {
  const snapshot = await getDocs(collection(db, "accounts"));

  const counts: Record<string, number> = {};

  snapshot.forEach((document) => {
    const data = document.data();

    if (data.status === "deleted") return;

    const role =
      typeof data.role === "string" && data.role
        ? data.role
        : "unknown";

    counts[role] = (counts[role] || 0) + 1;
  });

  return counts;
}

/**
 * Permissions for one role, used by the Admin Dashboard sidebar.
 * Returns `null` when nothing is known about the role, which callers
 * treat as "don't restrict" so a missing document can't lock people out.
 */
export async function fetchPermissionsForRole(
  roleKey: string
): Promise<string[] | null> {
  const snapshot = await getDoc(doc(db, "roles", roleKey));

  if (snapshot.exists()) {
    return sanitizePermissions(
      roleKey,
      snapshot.data().permissions
    );
  }

  const fallback = DEFAULT_ROLES.find(
    (role) => role.key === roleKey
  );

  return fallback
    ? sanitizePermissions(roleKey, fallback.permissions)
    : null;
}

/* =====================================================
   WRITE
===================================================== */

export async function savePermissions(
  role: RoleRecord,
  permissions: string[],
  actor: RoleActor
): Promise<string[]> {
  const clean = sanitizePermissions(role.key, permissions);

  await updateDoc(doc(db, "roles", role.key), {
    permissions: clean,
    updatedAt: serverTimestamp(),
    updatedBy: actor.id || null,
  });

  await logRoleActivity(
    actor,
    "Updated Role Permissions",
    `Updated permissions for the ${role.name} role.`,
    { roleKey: role.key, permissions: clean }
  );

  return clean;
}

export async function saveRoleDetails(
  role: RoleRecord,
  details: { name: string; description: string },
  actor: RoleActor
): Promise<RoleRecord> {
  const name = details.name.trim();
  const description = details.description.trim();

  if (!name) {
    throw new Error("Role name is required.");
  }

  await updateDoc(doc(db, "roles", role.key), {
    name,
    description,
    updatedAt: serverTimestamp(),
    updatedBy: actor.id || null,
  });

  await logRoleActivity(
    actor,
    "Updated Role",
    `Updated the details of the ${name} role.`,
    { roleKey: role.key }
  );

  return { ...role, name, description };
}

export async function createRole(
  details: { name: string; description: string },
  existingRoles: RoleRecord[],
  actor: RoleActor
): Promise<RoleRecord> {
  const name = details.name.trim();
  const description = details.description.trim();

  if (!name) {
    throw new Error("Role name is required.");
  }

  const key = slugify(name);

  if (!key) {
    throw new Error(
      "Role name must contain letters or numbers."
    );
  }

  const nameTaken = existingRoles.some(
    (role) =>
      role.key === key ||
      role.name.toLowerCase() === name.toLowerCase()
  );

  if (nameTaken) {
    throw new Error("A role with this name already exists.");
  }

  await setDoc(doc(db, "roles", key), {
    name,
    description,
    permissions: [],
    isSystem: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: actor.id || null,
  });

  await logRoleActivity(
    actor,
    "Created Role",
    `Created the ${name} role.`,
    { roleKey: key }
  );

  return {
    key,
    name,
    description,
    permissions: [],
    isSystem: false,
  };
}

export async function deleteRole(
  role: RoleRecord,
  actor: RoleActor
): Promise<void> {
  if (role.isSystem) {
    throw new Error("Built-in roles cannot be deleted.");
  }

  // Re-check right before deleting, in case an account was
  // assigned to this role after the page loaded.
  const assigned = await getDocs(
    query(
      collection(db, "accounts"),
      where("role", "==", role.key)
    )
  );

  const stillInUse = assigned.docs.some(
    (document) => document.data().status !== "deleted"
  );

  if (stillInUse) {
    throw new Error(
      "This role still has users. Move them to another role first."
    );
  }

  await deleteDoc(doc(db, "roles", role.key));

  await logRoleActivity(
    actor,
    "Deleted Role",
    `Deleted the ${role.name} role.`,
    { roleKey: role.key }
  );
}