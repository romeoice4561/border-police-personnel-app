/**
 * Unit tests for Supabase Storage config resolution (Phase 24B-1) — pure, no
 * network. Verifies graceful "not configured" behavior and URL derivation.
 *
 * Run with:
 *   npx tsx --test lib/portrait/__tests__/portrait_storage.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveSupabaseStorageConfig, resolveSupabaseUrl } from "@/lib/portrait/portrait_storage";

test("returns null when the service-role key is absent (feature not configured)", () => {
  const cfg = resolveSupabaseStorageConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" });
  assert.equal(cfg, null);
});

test("resolves config from explicit URL + service-role key with default bucket", () => {
  const cfg = resolveSupabaseStorageConfig({
    SUPABASE_SERVICE_ROLE_KEY: "svc",
    NEXT_PUBLIC_SUPABASE_URL: "https://proj.supabase.co/",
  });
  assert.ok(cfg);
  assert.equal(cfg?.supabaseUrl, "https://proj.supabase.co");
  assert.equal(cfg?.bucket, "portraits");
});

test("honors a custom bucket name", () => {
  const cfg = resolveSupabaseStorageConfig({
    SUPABASE_SERVICE_ROLE_KEY: "svc",
    NEXT_PUBLIC_SUPABASE_URL: "https://proj.supabase.co",
    SUPABASE_PORTRAIT_BUCKET: "officer-portraits",
  });
  assert.equal(cfg?.bucket, "officer-portraits");
});

test("derives the Supabase URL from a db.<ref>.supabase.co DATABASE_URL host", () => {
  const url = resolveSupabaseUrl({
    DATABASE_URL: "postgresql://postgres:pw@db.abcd1234.supabase.co:5432/postgres",
  });
  assert.equal(url, "https://abcd1234.supabase.co");
});

test("derives the Supabase URL from a pooler DATABASE_URL", () => {
  const url = resolveSupabaseUrl({
    DATABASE_URL: "postgresql://postgres.wxyz9999:pw@aws-0-region.pooler.supabase.com:6543/postgres",
  });
  assert.equal(url, "https://wxyz9999.supabase.co");
});

test("returns null URL when nothing is derivable", () => {
  assert.equal(resolveSupabaseUrl({}), null);
});
