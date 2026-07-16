import { test } from "node:test";
import assert from "node:assert/strict";

import { ROLES, ROLE_PERMISSIONS, defaultPermissionsForRole, hasPermission, isRole } from "@/lib/auth/roles";
import {
  homeRouteForRole,
  homeRouteForUser,
  AUTH_ENFORCED,
  isPublicRoute,
  requiredPermissionForRoute,
  LOGIN_ROUTE,
} from "@/lib/auth/auth_config";
import { MockAuthBackend } from "@/lib/auth/mock_auth_backend";
import type { AuthUser } from "@/lib/auth/types";

// Phase 47 — Authentication enforcement + RBAC.

test("authentication is ENFORCED this phase (single master switch is ON)", () => {
  assert.equal(AUTH_ENFORCED, true);
});

test("roles are admin/commander/officer and isRole validates", () => {
  assert.deepEqual([...ROLES], ["admin", "commander", "officer"]);
  assert.equal(isRole("admin"), true);
  assert.equal(isRole("superuser"), false);
  assert.equal(isRole(null), false);
});

test("admin has every permission; officer is least-privileged; permissions are role-independent checks", () => {
  assert.equal(hasPermission(ROLE_PERMISSIONS.admin, "admin.manage"), true);
  assert.equal(hasPermission(ROLE_PERMISSIONS.commander, "admin.manage"), false);
  assert.equal(hasPermission(ROLE_PERMISSIONS.commander, "commander.search"), true);
  assert.equal(hasPermission(ROLE_PERMISSIONS.officer, "officer.viewOwn"), true);
  assert.equal(hasPermission(ROLE_PERMISSIONS.officer, "officers.edit"), false);
  // Permission check is by capability, not role name — an arbitrary granted list works.
  assert.equal(hasPermission(["gallery.view"], "gallery.view"), true);
  assert.equal(hasPermission(undefined, "gallery.view"), false);
});

test("Phase 47 role capabilities: officer may search + gallery but not view others/download; commander cannot admin-manage or profile-manage", () => {
  // Officer — Search + Gallery + own profile, nothing more.
  assert.equal(hasPermission(ROLE_PERMISSIONS.officer, "search.view"), true);
  assert.equal(hasPermission(ROLE_PERMISSIONS.officer, "gallery.view"), true);
  assert.equal(hasPermission(ROLE_PERMISSIONS.officer, "officers.view"), false); // no directory / others' full profile
  assert.equal(hasPermission(ROLE_PERMISSIONS.officer, "documents.download"), false); // no confidential downloads
  assert.equal(hasPermission(ROLE_PERMISSIONS.officer, "dashboard.view"), false);
  assert.equal(hasPermission(ROLE_PERMISSIONS.officer, "statistics.view"), false);

  // Commander — full read/search + document download, but no user mgmt / system config.
  assert.equal(hasPermission(ROLE_PERMISSIONS.commander, "officers.view"), true);
  assert.equal(hasPermission(ROLE_PERMISSIONS.commander, "documents.download"), true);
  assert.equal(hasPermission(ROLE_PERMISSIONS.commander, "search.view"), true);
  assert.equal(hasPermission(ROLE_PERMISSIONS.commander, "admin.manage"), false);
  assert.equal(hasPermission(ROLE_PERMISSIONS.commander, "profile.manage"), false);

  // Admin — everything, including profile management.
  assert.equal(hasPermission(ROLE_PERMISSIONS.admin, "profile.manage"), true);
  assert.equal(hasPermission(ROLE_PERMISSIONS.admin, "documents.download"), true);
});

test("route protection map: /login is public; each route maps to the right capability; officers-detail is auth-only", () => {
  assert.equal(isPublicRoute(LOGIN_ROUTE), true);
  assert.equal(isPublicRoute("/dashboard"), false);

  assert.equal(requiredPermissionForRoute("/dashboard"), "dashboard.view");
  assert.equal(requiredPermissionForRoute("/commander-search"), "commander.search");
  assert.equal(requiredPermissionForRoute("/search"), "search.view");
  assert.equal(requiredPermissionForRoute("/statistics"), "statistics.view");
  assert.equal(requiredPermissionForRoute("/gallery"), "gallery.view");
  assert.equal(requiredPermissionForRoute("/admin/portraits"), "profile.manage");

  // Officer DIRECTORY (index) needs officers.view…
  assert.equal(requiredPermissionForRoute("/officers"), "officers.view");
  // …but an individual profile is auth-only (officers open colleagues from
  // Search and get the restricted view — enforced in the profile component).
  assert.equal(requiredPermissionForRoute("/officers/ภาค4%2F20"), null);
  assert.equal(requiredPermissionForRoute("/officers/123"), null);

  // /me is auth-only (every role sees its own profile).
  assert.equal(requiredPermissionForRoute("/me"), null);
});

test("defaultPermissionsForRole returns a fresh copy (not the shared array)", () => {
  const a = defaultPermissionsForRole("commander");
  a.push("admin.manage");
  assert.equal(hasPermission(ROLE_PERMISSIONS.commander, "admin.manage"), false); // source unchanged
});

test("role → home route: admin/commander → dashboard; officer → centralized /me", () => {
  assert.equal(homeRouteForRole("admin"), "/dashboard");
  assert.equal(homeRouteForRole("commander"), "/dashboard");
  assert.equal(homeRouteForRole("officer"), "/me");
  // Officers always route to /me (which resolves to their own profile),
  // regardless of whether the id is known to the caller.
  const officer: Pick<AuthUser, "role" | "officerId"> = { role: "officer", officerId: "ภาค4/20" };
  assert.equal(homeRouteForUser(officer), "/me");
  assert.equal(homeRouteForUser({ role: "officer", officerId: null }), "/me");
  assert.equal(homeRouteForUser({ role: "admin", officerId: null }), "/dashboard");
});

// ── Mock backend ──

test("mock backend authenticates admin/414 as admin with full permissions", async () => {
  const res = await new MockAuthBackend().authenticate("admin", "414");
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.user.role, "admin");
    assert.equal(res.user.officerId, null);
    assert.equal(res.user.isActive, true);
    assert.ok(hasPermission(res.user.permissions, "admin.manage"));
  }
});

test("mock backend authenticates BPP414/414 as commander (username case-insensitive, trimmed)", async () => {
  const res = await new MockAuthBackend().authenticate("  BPP414  ", "414");
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.user.role, "commander");
    assert.equal(res.user.username, "bpp414");
    assert.equal(hasPermission(res.user.permissions, "commander.search"), true);
    assert.equal(hasPermission(res.user.permissions, "admin.manage"), false);
  }
});

test("mock backend rejects wrong password and unknown user with a stable error code", async () => {
  const bad = await new MockAuthBackend().authenticate("admin", "0000");
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.error, "INVALID_CREDENTIALS");

  const unknown = await new MockAuthBackend().authenticate("nobody", "414");
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.equal(unknown.error, "INVALID_CREDENTIALS");
});
