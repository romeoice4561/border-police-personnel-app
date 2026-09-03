/**
 * Commander Intelligence Dashboard API client (Phase 2B).
 *
 * Six read-only endpoints, each corresponding to one dashboard section.
 * Follows drug_intelligence_client.ts's exact pattern: toQueryString(),
 * request<T>(), same { data } / error envelope, same ApiClientError.
 *
 * No writes — commander dashboard is read-only.
 */

import { ApiClientError } from "@/lib/ui/api_client";
import type {
  CommanderOverviewData,
  CommanderSeizuresData,
  CommanderTrendData,
  CommanderAreasData,
  CommanderUnitsData,
  CommanderSignalsData,
} from "@/lib/drug_intelligence/drug_commander_dashboard_types";

interface ApiEnvelope<T> {
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

function toQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

async function request<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { headers: { Accept: "application/json" } });
  } catch (cause) {
    throw new ApiClientError("Network error — the server could not be reached.", 0, "NETWORK_ERROR", cause);
  }

  let body: ApiEnvelope<T>;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiClientError("The server returned an unreadable response.", response.status, "BAD_RESPONSE");
  }

  if (!response.ok || body.error) {
    const err = body.error;
    throw new ApiClientError(
      err?.message ?? `Request failed (${response.status})`,
      response.status,
      err?.code ?? "REQUEST_FAILED",
      err?.details
    );
  }

  return body.data as T;
}

/** Parameters accepted by all bounded commander endpoints. */
export interface CommanderQueryParams {
  actorId: string;
  fy?: number;
  from?: string;
  to?: string;
  hqId?: number;
  regionId?: number;
  battalionId?: number;
  companyId?: number;
  province?: string;
  status?: string;
}

const BASE = "/drug-intelligence/command";

export const drugCommanderClient = {
  async getOverview(params: CommanderQueryParams): Promise<CommanderOverviewData> {
    return request<CommanderOverviewData>(`${BASE}/overview${toQueryString(params)}`);
  },

  async getSeizures(params: CommanderQueryParams): Promise<CommanderSeizuresData> {
    return request<CommanderSeizuresData>(`${BASE}/seizures${toQueryString(params)}`);
  },

  async getTrend(params: CommanderQueryParams): Promise<CommanderTrendData> {
    return request<CommanderTrendData>(`${BASE}/trend${toQueryString(params)}`);
  },

  async getAreas(params: CommanderQueryParams): Promise<CommanderAreasData> {
    return request<CommanderAreasData>(`${BASE}/areas${toQueryString(params)}`);
  },

  async getUnits(params: CommanderQueryParams): Promise<CommanderUnitsData> {
    return request<CommanderUnitsData>(`${BASE}/units${toQueryString(params)}`);
  },

  async getSignals(actorId: string): Promise<CommanderSignalsData> {
    return request<CommanderSignalsData>(`${BASE}/signals${toQueryString({ actorId })}`);
  },
};

export { ApiClientError } from "@/lib/ui/api_client";
