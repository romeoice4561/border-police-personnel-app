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
  /** Search across officers (the /search page). Granted to every role — officers may search too. */
  "search.view",
  /** See the officer directory + full officer profiles (every section). Admin/commander only. */
  "officers.view",
  "officers.edit",
  /** See own profile in full (the /me route). Every role has this. */
  "officer.viewOwn",
  "statistics.view",
  "gallery.view",
  /** Download confidential documents / access protected files from the gallery. Not granted to officers. */
  "documents.download",
  /** Profile / portrait management tooling (admin/portraits). Admin only. */
  "profile.manage",
  "review.view",
  "documents.manage",
  "admin.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Default permission bundle per role. A user's effective permissions come from their `permissions` field, seeded from here. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  // Administrator — full access (every permission).
  admin: [...PERMISSIONS],
  // Commander — may view/search every officer, gallery, statistics, reports,
  // and download documents; but NOT delete data, manage users, or configure
  // the system (no admin.manage / profile.manage).
  commander: [
    "dashboard.view",
    "commander.search",
    "search.view",
    "officers.view",
    "officers.edit",
    "statistics.view",
    "gallery.view",
    "documents.download",
    "review.view",
    "documents.manage",
  ],
  // Officer — own full profile, plus Search and Gallery (browse/preview only:
  // no documents.download, no officers.view of others' private sections).
  officer: ["officer.viewOwn", "search.view", "gallery.view"],
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
