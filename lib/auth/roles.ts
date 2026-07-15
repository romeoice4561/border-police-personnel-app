/**
 * Roles & permissions (Phase 46 — Authentication Foundation).
 *
 * Permissions are INDEPENDENT from roles: the UI checks `hasPermission()`
 * against a user's granted permission list, never role names. A role is just a
 * convenient default BUNDLE of permissions (ROLE_PERMISSIONS). A future backend
 * can grant/revoke individual permissions per user without any UI change.
 *
 * Pure data + pure functions — no I/O, no React, no DB.
 */

/** The three modelled roles. Officer is modelled now, seeded later. */
export const ROLES = ["admin", "commander", "officer"] as const;
export type Role = (typeof ROLES)[number];

/**
 * The permission vocabulary. Keep these fine-grained and feature-oriented so
 * pages gate on a capability, not a role. Add new permissions here as features
 * are protected; existing checks keep working.
 */
export const PERMISSIONS = [
  "dashboard.view",
  "commander.search",
  "officers.view",
  "officers.edit",
  "officer.viewOwn",
  "statistics.view",
  "gallery.view",
  "review.view",
  "documents.manage",
  "admin.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Default permission bundle per role. A user's effective permissions come from their `permissions` field, seeded from here. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: [...PERMISSIONS],
  commander: [
    "dashboard.view",
    "commander.search",
    "officers.view",
    "officers.edit",
    "statistics.view",
    "gallery.view",
    "review.view",
    "documents.manage",
  ],
  officer: ["officer.viewOwn"],
};

/** The default permissions a freshly-created user of `role` receives. */
export function defaultPermissionsForRole(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

/**
 * True when `granted` includes `permission`. This is the ONE check the whole UI
 * uses — never `role === "admin"`. Accepts the user's granted list so a future
 * per-user grant/revoke works with no call-site change.
 */
export function hasPermission(granted: readonly Permission[] | undefined, permission: Permission): boolean {
  return Boolean(granted?.includes(permission));
}

export function isRole(value: string | null | undefined): value is Role {
  return value != null && (ROLES as readonly string[]).includes(value);
}
