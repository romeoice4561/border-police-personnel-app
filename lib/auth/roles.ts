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
  /** Edit ANY officer's profile. Admin only — see officer.editOwn for the officer's self-edit capability. */
  "officers.edit",
  /**
   * Edit ONLY your own profile (ownership-scoped, not role-scoped). Granted to
   * the officer role. A component checks this ALONGSIDE an ownership test
   * (e.g. `can("officer.editOwn") && isOwnProfile`) — the permission alone
   * never implies "this specific record"; ownership is always verified
   * separately. Reusable pattern for future self-service modules (documents,
   * media, timeline, training, awards): grant `<feature>.editOwn` and check it
   * with the same `can(...) && isOwnRecord` shape.
   */
  "officer.editOwn",
  /** See own profile in full (the /me route). Every role has this. */
  "officer.viewOwn",
  /** Permanently remove an officer record. Admin only. */
  "officers.delete",
  "statistics.view",
  "gallery.view",
  /** Download confidential documents / access protected files from the gallery. Not granted to officers. */
  "documents.download",
  /** Upload/replace media (portraits, documents) for ANY officer. Admin only — officers upload their own via officer.editOwn-scoped actions. */
  "media.manage",
  /** Profile / portrait management tooling (admin/portraits). Admin only. */
  "profile.manage",
  "review.view",
  "documents.manage",
  /** Create/manage user accounts. Admin only. */
  "users.manage",
  /** AI-assisted bulk import tooling. Admin only. */
  "ai.import",
  "admin.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Default permission bundle per role. A user's effective permissions come from their `permissions` field, seeded from here. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  // Administrator — full access (every permission).
  admin: [...PERMISSIONS],
  // Commander — READ ONLY except the review workflow: may view/search every
  // officer, gallery, statistics, review queue, and download/export documents.
  // NEVER edit or delete an officer record, manage users, run AI import, or
  // touch system/profile configuration.
  commander: [
    "dashboard.view",
    "commander.search",
    "search.view",
    "officers.view",
    "statistics.view",
    "gallery.view",
    "documents.download",
    "review.view",
  ],
  // Officer — own full profile (view AND edit, ownership-scoped via
  // officer.editOwn), plus Search and Gallery (browse/preview only: no
  // documents.download, no officers.view of others' private sections — those
  // are covered by the restricted profile view instead).
  officer: ["officer.viewOwn", "officer.editOwn", "search.view", "gallery.view"],
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
