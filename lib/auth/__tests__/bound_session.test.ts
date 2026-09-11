/**
 * DI-11B bound session token tests.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { BOUND_SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import {
  boundSessionSecret,
  BoundSessionSecretError,
  signBoundSessionToken,
  verifyBoundSessionToken,
  mintBoundSessionCookieHeader,
  boundSessionCookie,
} from "@/lib/auth/bound_session";

test("signed token round-trips actorId and rejects tampering", () => {
  const token = signBoundSessionToken("mock:admin");
  const payload = verifyBoundSessionToken(token);
  assert.equal(payload?.actorId, "mock:admin");

  const broken = `${token.slice(0, -2)}xx`;
  assert.equal(verifyBoundSessionToken(broken), null);
  assert.equal(verifyBoundSessionToken("v1.not-valid.sig"), null);
  assert.equal(verifyBoundSessionToken(""), null);
});

test("minted cookie uses the HttpOnly actor cookie name, not presence cookie", () => {
  const header = mintBoundSessionCookieHeader({ id: "mock:bpp414" });
  assert.match(header, new RegExp(`^${BOUND_SESSION_COOKIE_NAME}=`));
  assert.doesNotMatch(header, /bppis_session=/);
  const token = header.split("=")[1] ?? "";
  assert.equal(verifyBoundSessionToken(token)?.actorId, "mock:bpp414");
});

test("production refuses the known development HMAC fallback", () => {
  assert.throws(
    () => boundSessionSecret({ NODE_ENV: "production" } as NodeJS.ProcessEnv),
    BoundSessionSecretError
  );
  const fromEnv = boundSessionSecret({ NODE_ENV: "production", BPPIS_BOUND_SESSION_SECRET: "unit-test-secret" } as NodeJS.ProcessEnv);
  assert.equal(fromEnv, "unit-test-secret");
});

test("bound cookie is HttpOnly SameSite=Lax and not JS-readable by name collision with presence cookie", () => {
  const header = boundSessionCookie("mock:admin", true);
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
  assert.match(header, /Max-Age=2592000/);
  assert.doesNotMatch(header, /bppis_session=/);
});
