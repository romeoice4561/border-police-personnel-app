/**
 * PWA static-cache policy (Phase 2E.1).
 *
 * Turbopack `next dev` reuses stable `/_next/static/chunks/_*.*.js` ids.
 * Cache-first of those URLs served a stale ActionGroup module after the
 * source hotfix. This test locks the network-first / version-bump contract.
 *
 * Run with:
 *   npx tsx --test lib/pwa/__tests__/sw_static_cache_policy.test.ts
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const sw = readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");

test("service worker cache version is past the poisoned bppis-pwa-v1 bucket", () => {
  assert.match(sw, /CACHE_VERSION = "bppis-pwa-v2"/);
  assert.doesNotMatch(sw, /CACHE_VERSION = "bppis-pwa-v1"/);
});

test(" /_next/static is network-first, not cache-first", () => {
  assert.match(sw, /NETWORK_FIRST_PREFIXES = \["\/_next\/static\/"\]/);
  assert.match(sw, /function isNetworkFirstStaticAsset/);
  assert.match(sw, /if \(isNetworkFirstStaticAsset\(url\)\)/);
});

test("icons and branding remain cache-first and pages/API stay uncached", () => {
  assert.match(sw, /CACHE_FIRST_PREFIXES = \["\/icons\/", "\/assets\/branding\/"\]/);
  assert.match(sw, /NETWORK-ONLY/);
  assert.match(sw, /if \(!isCacheableStaticAsset\(url\)\) return/);
});
