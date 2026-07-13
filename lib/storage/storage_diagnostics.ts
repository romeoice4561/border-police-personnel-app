/**
 * Supabase Storage diagnostic helpers (Phase 29A.1 — Storage Repair).
 *
 * Provides three public utilities:
 *
 *   validateStorageEnvironment()  — inspect env vars; returns a detailed
 *     status with exactly which variable(s) are missing, no network I/O.
 *
 *   isStorageConfigured()  — quick boolean check, no network.
 *
 *   checkBucketExists()  — makes one GET to the Supabase Storage Management
 *     API to verify a bucket exists. Returns { exists: true } or
 *     { exists: false, error: "<human message>" }.
 *
 * Used by the portrait and document containers to emit actionable 503
 * messages instead of the generic "not configured" fallback.
 */

import { resolveSupabaseUrl } from "@/lib/portrait/portrait_storage";

// ── Types ────────────────────────────────────────────────────────────────────

export interface StorageEnvStatus {
  /** true when SUPABASE_SERVICE_ROLE_KEY is present. */
  serviceRoleKeyPresent: boolean;
  /** The resolved Supabase project URL, or null if undeterminable. */
  supabaseUrl: string | null;
  /** false when any required variable is absent. */
  configured: boolean;
  /** Names of the missing variables (empty when configured=true). */
  missingVars: string[];
  /** Human-readable reason when configured=false; empty string when configured=true. */
  reason: string;
}

export interface BucketCheckResult {
  exists: boolean;
  /** Set when exists=false to describe the failure reason. */
  error?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validates Supabase Storage environment variables without any network I/O.
 * Returns a detailed status with exactly which variable(s) are missing so the
 * caller can surface an actionable error message.
 */
export function validateStorageEnvironment(
  env: Record<string, string | undefined> = process.env
): StorageEnvStatus {
  const serviceRoleKeyPresent = Boolean(env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  const supabaseUrl = resolveSupabaseUrl(env);
  const missingVars: string[] = [];

  if (!serviceRoleKeyPresent) {
    missingVars.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!supabaseUrl) {
    missingVars.push("NEXT_PUBLIC_SUPABASE_URL (or DATABASE_URL / DIRECT_URL)");
  }

  if (missingVars.length > 0) {
    return {
      serviceRoleKeyPresent,
      supabaseUrl,
      configured: false,
      missingVars,
      reason:
        `Storage uploads are not configured. Missing environment variable(s): ` +
        `${missingVars.join(", ")}. ` +
        `Add them to .env.local and restart the dev server.`,
    };
  }

  return {
    serviceRoleKeyPresent: true,
    supabaseUrl: supabaseUrl!,
    configured: true,
    missingVars: [],
    reason: "",
  };
}

/**
 * Returns true only when all required storage env vars are present.
 * No network I/O — use checkBucketExists() for a full connectivity check.
 */
export function isStorageConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return validateStorageEnvironment(env).configured;
}

/**
 * Calls the Supabase Storage Management API to verify that `bucket` exists
 * in the project at `supabaseUrl`. Requires the service-role key.
 *
 * Returns { exists: true } on HTTP 200.
 * Returns { exists: false, error } on 404/400 (missing bucket) or network
 * failure — the error string is human-readable and safe to surface directly.
 */
export async function checkBucketExists(
  supabaseUrl: string,
  serviceRoleKey: string,
  bucket: string
): Promise<BucketCheckResult> {
  try {
    const res = await fetch(
      `${supabaseUrl}/storage/v1/bucket/${encodeURIComponent(bucket)}`,
      { headers: { Authorization: `Bearer ${serviceRoleKey}` } }
    );
    if (res.ok) return { exists: true };
    if (res.status === 404 || res.status === 400) {
      return {
        exists: false,
        error:
          `Storage bucket '${bucket}' does not exist. ` +
          `Create it in your Supabase project under Storage → Buckets, ` +
          `or set SUPABASE_DOCUMENT_BUCKET / SUPABASE_PORTRAIT_BUCKET to an existing bucket name.`,
      };
    }
    const body = await res.text().catch(() => "");
    return {
      exists: false,
      error: `Bucket check returned unexpected status ${res.status}: ${body.slice(0, 200)}`,
    };
  } catch (e) {
    return {
      exists: false,
      error: `Could not reach Supabase Storage: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
