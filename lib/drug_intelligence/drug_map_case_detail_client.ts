/**
 * DI-10E.6C — Map case-detail client fetch + in-session cache/race helpers.
 *
 * Separate from fetchDrugGeoResult. Cache is memory-only (no localStorage).
 */

import { ApiClientError } from "@/lib/ui/api_client";
import type { DrugMapCaseDetailResult } from "@/lib/drug_intelligence/drug_map_case_detail";

export type { DrugMapCaseDetailResult, DrugMapCaseDetailPerson, DrugMapCaseDetailSeizure, DrugMapCaseDetailUnit, DrugMapCappedList } from "@/lib/drug_intelligence/drug_map_case_detail";

export async function fetchDrugMapCaseDetail(
  actorId: string,
  caseId: string,
  signal?: AbortSignal
): Promise<DrugMapCaseDetailResult> {
  let response: Response;
  try {
    response = await fetch(`/api/drug-intelligence/map/cases/${encodeURIComponent(caseId)}?actorId=${encodeURIComponent(actorId)}`, {
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiClientError("Network error — the server could not be reached.", 0, "NETWORK_ERROR", cause);
  }

  let body: { data?: DrugMapCaseDetailResult; error?: { code: string; message: string; details?: unknown } };
  try {
    body = await response.json();
  } catch {
    throw new ApiClientError("The server returned an unreadable response.", response.status, "BAD_RESPONSE");
  }

  if (!response.ok || body.error) {
    const err = body.error;
    throw new ApiClientError(err?.message ?? `Request failed (${response.status})`, response.status, err?.code ?? "REQUEST_FAILED", err?.details);
  }

  return body.data as DrugMapCaseDetailResult;
}

export interface DrugMapCaseDetailSessionLoad {
  data: DrugMapCaseDetailResult | null;
  fromCache: boolean;
  stale: boolean;
  aborted: boolean;
}

type DrugMapCaseDetailFetch = (caseId: string, signal: AbortSignal) => Promise<DrugMapCaseDetailResult>;

export function createDrugMapCaseDetailSession(fetchFn?: DrugMapCaseDetailFetch) {
  const cache = new Map<string, DrugMapCaseDetailResult>();
  let token = 0;
  let controller: AbortController | null = null;

  return {
    cache,
    async load(caseId: string | null, requestFn: DrugMapCaseDetailFetch | undefined = fetchFn): Promise<DrugMapCaseDetailSessionLoad> {
      if (!caseId) return { data: null, fromCache: false, stale: false, aborted: false };
      const cached = cache.get(caseId);
      if (cached) return { data: cached, fromCache: true, stale: false, aborted: false };
      if (!requestFn) throw new Error("Map case detail fetch function is required");

      const myToken = ++token;
      controller?.abort();
      controller = new AbortController();
      try {
        const data = await requestFn(caseId, controller.signal);
        if (myToken !== token) return { data: null, fromCache: false, stale: true, aborted: false };
        cache.set(caseId, data);
        return { data, fromCache: false, stale: false, aborted: false };
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return { data: null, fromCache: false, stale: false, aborted: true };
        }
        if (myToken !== token) return { data: null, fromCache: false, stale: true, aborted: false };
        throw error;
      }
    },
    invalidate(caseId: string): void {
      cache.delete(caseId);
    },
    close(): void {
      token += 1;
      controller?.abort();
      controller = null;
    },
  };
}
