import { test } from "node:test";
import assert from "node:assert/strict";

import { ROLES, ROLE_PERMISSIONS, defaultPermissionsForRole, hasPermission, isRole } from "@/lib/auth/roles";
import { homeRouteForRole, homeRouteForUser, AUTH_ENFORCED } from "@/lib/auth/auth_config";
import { MockAuthBackend } from "@/lib/auth/mock_auth_backend";
import type { AuthUser } from "@/lib/auth/types";

// Phase 46 — Authentication foundation.

test("the soft guard is OFF this phase (single enforcement switch)", () => {
  assert.equal(AUTH_ENFORCED, false);
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
