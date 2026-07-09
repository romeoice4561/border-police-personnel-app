/**
 * Unit tests for production environment validation (Phase 16A): required-vs-
 * feature detection, the report shape, environment resolution, and the
 * readable formatter. Pure — an injected env object, no process.env mutation.
 *
 * Run with:
 *   npx tsx --test lib/config/__tests__/env_validation.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { formatEnvReport, resolveEnvironment, validateEnvironment } from "@/lib/config/env_validation";

/** A complete valid production env (all required present). */
function fullEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    DATABASE_URL: "postgres://x",
    DIRECT_URL: "postgres://y",
    NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    OPENAI_API_KEY: "sk-x",
    GOOGLE_APPLICATION_CREDENTIALS: "creds.json",
    GOOGLE_DRIVE_ROOT_FOLDER: "folder-id",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    SUPABASE_PORTRAIT_BUCKET: "portraits",
    OPENAI_MODEL: "gpt-5.5",
    ...overrides,
  } as NodeJS.ProcessEnv;
}

test("a complete environment is valid with no missing required vars", () => {
  const report = validateEnvironment(fullEnv());
  assert.equal(report.valid, true);
  assert.deepEqual(report.missingRequired, []);
  assert.equal(report.environment, "production");
});

test("a missing required variable makes the report invalid and lists it", () => {
  const report = validateEnvironment(fullEnv({ DATABASE_URL: undefined, NEXT_PUBLIC_SUPABASE_ANON_KEY: "" }));
  assert.equal(report.valid, false);
  assert.ok(report.missingRequired.includes("DATABASE_URL"));
  assert.ok(report.missingRequired.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
});

test("a missing feature variable does NOT invalidate, but is reported", () => {
  const report = validateEnvironment(fullEnv({ OPENAI_API_KEY: undefined }));
  assert.equal(report.valid, true);
  assert.ok(report.missingFeature.includes("OPENAI_API_KEY"));
});

test("OPENAI_MODEL is optional-with-default: absent does not count as a missing feature", () => {
  const report = validateEnvironment(fullEnv({ OPENAI_MODEL: undefined }));
  assert.equal(report.valid, true);
  assert.equal(report.missingFeature.includes("OPENAI_MODEL"), false);
});

test("whitespace-only values count as missing", () => {
  const report = validateEnvironment(fullEnv({ DIRECT_URL: "   " }));
  assert.equal(report.valid, false);
  assert.ok(report.missingRequired.includes("DIRECT_URL"));
});

test("resolveEnvironment normalizes NODE_ENV", () => {
  assert.equal(resolveEnvironment({ NODE_ENV: "production" } as NodeJS.ProcessEnv), "production");
  assert.equal(resolveEnvironment({ NODE_ENV: "development" } as NodeJS.ProcessEnv), "development");
  // An unset NODE_ENV resolves to "unknown".
  assert.equal(resolveEnvironment({} as NodeJS.ProcessEnv), "unknown");
});

test("formatEnvReport lists an ERROR line when required vars are missing", () => {
  const text = formatEnvReport(validateEnvironment(fullEnv({ DATABASE_URL: undefined })));
  assert.match(text, /ERROR:/);
  assert.match(text, /DATABASE_URL/);
  assert.match(text, /✗ DATABASE_URL/);
});

test("formatEnvReport confirms when all required present, and never leaks values", () => {
  const text = formatEnvReport(validateEnvironment(fullEnv()));
  assert.match(text, /All required variables present/);
  assert.doesNotMatch(text, /postgres:\/\//); // no secret values in the report
  assert.doesNotMatch(text, /anon-key/);
});
