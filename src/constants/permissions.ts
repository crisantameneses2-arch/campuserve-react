/**
 * Permissions that can be granted to a role.
 *
 * Each `key` matches the page id used by the Admin Dashboard
 * (`currentPage`), so the sidebar can check a permission directly.
 */
export const PERMISSIONS = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "View the overview statistics.",
  },
  {
    key: "userAccounts",
    label: "User Accounts",
    description: "Create, edit and deactivate user accounts.",
  },
  {
    key: "rolesPermissions",
    label: "Roles & Permissions",
    description: "Manage roles and what each role can access.",
  },
  {
    key: "documentRequests",
    label: "Document Requests",
    description: "View all document requests.",
  },
  {
    key: "itemReservations",
    label: "Item Reservations",
    description: "View all item reservations.",
  },
  {
    key: "reportsAnalytics",
    label: "Reports & Analytics",
    description: "View reports and analytics.",
  },
  {
    key: "activityLogs",
    label: "Activity Logs",
    description: "View the system activity history.",
  },
  {
    key: "systemSettings",
    label: "System Settings",
    description: "Change system-wide settings.",
  },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const ALL_PERMISSION_KEYS: string[] = PERMISSIONS.map(
  (permission) => permission.key
);

/** The role key stored in `accounts.role` for administrators. */
export const ADMIN_ROLE_KEY = "admin";

/**
 * Permissions the Administrator role can never lose.
 * This prevents an admin from locking everyone out of the
 * pages needed to fix permissions.
 */
export const ADMIN_LOCKED_PERMISSIONS: string[] = [
  "dashboard",
  "userAccounts",
  "rolesPermissions",
];

export type DefaultRole = {
  key: string;
  name: string;
  description: string;
  permissions: string[];
};

/**
 * Built-in roles. Their keys match the `role` values already used
 * in the `accounts` collection. They are created in Firestore the
 * first time the Roles & Permissions page is opened.
 */
export const DEFAULT_ROLES: DefaultRole[] = [
  {
    key: "student",
    name: "Student",
    description: "Regular student account",
    permissions: [],
  },
  {
    key: "alumni",
    name: "Alumni",
    description: "Former students with approved access",
    permissions: [],
  },
  {
    key: "general_office",
    name: "General Office",
    description: "Handles general office transactions",
    permissions: ["dashboard", "itemReservations"],
  },
  {
    key: "registrar",
    name: "Registrar",
    description: "Manages academic document requests",
    permissions: ["dashboard", "documentRequests"],
  },
  {
    key: "cashier",
    name: "Cashier",
    description: "Handles payments for requests and reservations",
    permissions: ["dashboard"],
  },
  {
    key: ADMIN_ROLE_KEY,
    name: "Administrator",
    description: "Full system management access",
    permissions: ALL_PERMISSION_KEYS,
  },
];