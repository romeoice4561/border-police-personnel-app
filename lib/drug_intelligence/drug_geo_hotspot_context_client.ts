/**
 * Client fetch for DI-8.2B hotspot context.
 */

import { ApiClientError } from "@/lib/ui/api_client";
import type { DrugGeoHotspotContextResult } from "@/lib/drug_intelligence/drug_geo_hotspot_context_service";

export async function fetchDrugGeoHotspotContext(
  actorId: string,
  caseIds: string[],
  signal?: AbortSignal,
): Promise<DrugGeoHotspotContextResult> {
  let response: Response;
  try {
    response = await fetch(`/api/drug-intelligence/map/hotspot-context?actorId=${encodeURIComponent(actorId)}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ caseIds }),
      signal,
    });
  } catch (cause) {
    throw new ApiClientError("Network error — the server could not be reached.", 0, "NETWORK_ERROR", cause);
  }

  let body: { data?: DrugGeoHotspotContextResult; error?: { code: string; message: string; details?: unknown } };
  try {
    body = await response.json();
  } catch {
    throw new ApiClientError("The server returned an unreadable response.", response.status, "BAD_RESPONSE");
  }

  if (!response.ok || body.error) {
    const err = body.error;
    throw new ApiClientError(err?.message ?? `Request failed (${response.status})`, response.status, err?.code ?? "REQUEST_FAILED", err?.details);
  }

  return body.data as DrugGeoHotspotContextResult;
}
