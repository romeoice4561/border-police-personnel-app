/**
 * GET /api/health — liveness + database reachability probe.
 *
 * Returns { status, database, version, timestamp }. 200 when the database
 * responds, 503 when it doesn't — but always a structured body so uptime
 * probes can read the state. When DATABASE_URL is unconfigured, the container
 * build itself fails and this reports the DB as unavailable rather than
 * throwing.
 */

import { getApiContainer } from "@/lib/api/api_container";
import { handleHealth, guarded } from "@/lib/api/api_handlers";
import { serviceUnavailable } from "@/lib/api/api_response";

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
      // createDatabaseClient throws when DATABASE_URL is unset — surface as a
      // structured unhealthy response, not a 500.
      const version = await appVersion();
      return serviceUnavailable(`Database not configured or unreachable (${version})`);
    }
  });
}
