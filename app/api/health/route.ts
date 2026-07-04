/**
 * GET /api/health — liveness + database reachability probe (Phase 16A).
 *
 * Returns { status, database, version, uptime, environment, timestamp }.
 * 200 when the database responds ("ok"), 503 when it doesn't ("degraded") —
 * always with the full structured body so uptime/deploy probes can read the
 * state. When DATABASE_URL is unconfigured, the container build itself fails
 * and this reports a degraded status rather than throwing.
 */

import { getApiContainer } from "@/lib/api/api_container";
import { handleHealth, guarded } from "@/lib/api/api_handlers";
import { jsonError } from "@/lib/api/api_response";
import { resolveEnvironment } from "@/lib/config/env_validation";

async function appVersion(): Promise<string> {
  try {
    const pkg = (await import("@/package.json")) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

export async function GET(): Promise<Response> {
  return guarded(async () => {
    try {
      const container = await getApiContainer();
      return await handleHealth(container);
    } catch {
      // createDatabaseClient throws when DATABASE_URL is unset — surface a
      // structured degraded response (full shape), not a 500.
      return jsonError("SERVICE_UNAVAILABLE", "Database not configured or unreachable", 503, {
        status: "degraded",
        database: "disconnected",
        version: await appVersion(),
        uptime: Math.round(typeof process !== "undefined" ? process.uptime() : 0),
        environment: resolveEnvironment(),
        timestamp: new Date().toISOString(),
      });
    }
  });
}
