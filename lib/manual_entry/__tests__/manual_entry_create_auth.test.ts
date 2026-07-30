/**
 * Manual Entry create permission gate (Phase XX.1).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { assertManualEntryCreatePermission } from "@/lib/manual_entry/manual_entry_api_handlers";
import { AUTH_ENFORCED, SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";

test("assertManualEntryCreatePermission allows admin with session when AUTH_ENFORCED", async () => {
  if (!AUTH_ENFORCED) {
    const allowed = await assertManualEntryCreatePermission(new Request("http://localhost/api/officers"), "mock:admin");
    assert.equal(allowed, null);
    return;
  }

  const deniedNoCookie = await assertManualEntryCreatePermission(
    new Request("http://localhost/api/officers", { method: "POST" }),
    "mock:admin"
  );
  assert.ok(deniedNoCookie);
  assert.equal(deniedNoCookie.status, 401);

  const adminOk = await assertManualEntryCreatePermission(
    new Request("http://localhost/api/officers", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=1` },
    }),
    "mock:admin"
  );
  assert.equal(adminOk, null);

  const commanderDenied = await assertManualEntryCreatePermission(
    new Request("http://localhost/api/officers", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=1` },
    }),
    "mock:bpp414"
  );
  assert.ok(commanderDenied);
  assert.equal(commanderDenied.status, 403);

  const officerDenied = await assertManualEntryCreatePermission(
    new Request("http://localhost/api/officers", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=1` },
    }),
    "mock:1101700123456"
  );
  assert.ok(officerDenied);
  assert.equal(officerDenied.status, 403);
});
