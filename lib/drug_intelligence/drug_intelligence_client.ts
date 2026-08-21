/**
 * Drug Intelligence API client (Phase DI-1 Round 2).
 *
 * The single layer through which the UI talks to /api/drug-intelligence/*.
 * Mirrors lib/ui/api_client.ts's request/requestPost pattern exactly (same
 * `{ data, meta }` / `{ error }` envelope, same ApiClientError — reused
 * directly, not redefined) so every Drug Intelligence component gets the
 * same typed-error handling React Query hooks and error UI already expect.
 * No component ever calls fetch() or touches Prisma directly — every write
 * goes through the Round 1/2 service layer's audit-logged path.
 */

import { ApiClientError } from "@/lib/ui/api_client";

interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface ApiEnvelope<T> {
  data?: T;
  meta?: PageMeta;
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

async function request<T>(path: string): Promise<{ data: T; meta?: PageMeta }> {
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
    throw new ApiClientError(err?.message ?? `Request failed (${response.status})`, response.status, err?.code ?? "REQUEST_FAILED", err?.details);
  }

  return { data: body.data as T, meta: body.meta };
}

async function requestPost<T>(path: string, body: unknown): Promise<{ data: T }> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw new ApiClientError("Network error — the server could not be reached.", 0, "NETWORK_ERROR", cause);
  }

  let parsed: ApiEnvelope<T>;
  try {
    parsed = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiClientError("The server returned an unreadable response.", response.status, "BAD_RESPONSE");
  }

  if (!response.ok || parsed.error) {
    const err = parsed.error;
    throw new ApiClientError(err?.message ?? `Request failed (${response.status})`, response.status, err?.code ?? "REQUEST_FAILED", err?.details);
  }

  return { data: parsed.data as T };
}

// ── Types (mirroring the Zod/service shapes server-side) ────────────────

export interface DrugIntelligenceStats {
  totalCases: number;
  totalPersons: number;
  totalPhones: number;
  totalDevices: number;
  totalVehicles: number;
}

export interface DrugCaseListRow {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
  arrestDate: string | null;
  province: string | null;
  reportingUnitText: string | null;
  updatedAt: string;
  personCount: number;
  seizedItemCount: number;
  seizedItemsSummary: string;
}

export interface DrugCaseListQuery {
  page?: number;
  pageSize?: number;
  query?: string;
  status?: string;
  province?: string;
  headquartersId?: number;
  regionId?: number;
  battalionId?: number;
  companyId?: number;
  arrestDateFrom?: string;
  arrestDateTo?: string;
}

export interface DrugPersonSummary {
  id: string;
  primaryFullName: string;
  nationality: string | null;
  dateOfBirth: string | null;
}

export interface DrugCasePersonRow {
  caseId: string;
  personId: string;
  role: string;
  linkedOfficerId: string | null;
  notes: string | null;
  person: DrugPersonSummary | null;
}

export interface DrugPhoneNumberSummary {
  id: string;
  normalizedNumber: string;
}

export interface DrugCasePhoneRow {
  caseId: string;
  personId: string;
  phoneNumberId: string;
  originalInput: string | null;
  status: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  recordedBy: string;
  notes: string | null;
  phoneNumber: DrugPhoneNumberSummary | null;
  person: DrugPersonSummary | null;
}

export interface DrugCaseSimRow {
  caseId: string;
  personId: string | null;
  simId: string;
  status: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  recordedBy: string;
  notes: string | null;
  person: DrugPersonSummary | null;
}

export interface DrugDeviceSummary {
  id: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  imei1: string | null;
  imei2: string | null;
}

export interface DrugCaseDeviceRow {
  caseId: string;
  personId: string | null;
  deviceId: string;
  status: string;
  recordedBy: string;
  notes: string | null;
  device: DrugDeviceSummary | null;
  person: DrugPersonSummary | null;
}

export interface DrugVehicleSummary {
  id: string;
  registrationNumber: string | null;
  registrationProvince: string | null;
  vehicleType: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  vin: string | null;
}

export interface DrugCaseVehicleRow {
  caseId: string;
  personId: string | null;
  vehicleId: string;
  status: string;
  recordedBy: string;
  notes: string | null;
  vehicle: DrugVehicleSummary | null;
  person: DrugPersonSummary | null;
}

export interface DrugSeizedItemRow {
  id: string;
  caseId: string;
  drugType: string;
  subtype: string | null;
  quantity: string | null;
  unit: string | null;
  weightGrams: string | null;
  packageCount: number | null;
  notes: string | null;
}

export interface DrugLocationSummary {
  id: string;
  name: string | null;
  addressText: string | null;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
}

export interface DrugCaseLocationRow {
  caseId: string;
  locationId: string;
  role: string;
  recordedBy: string;
  notes: string | null;
  location: DrugLocationSummary | null;
}

export interface DrugCaseDetail {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
  arrestDate: string | null;
  arrestTime: string | null;
  headquartersId: number | null;
  regionId: number | null;
  battalionId: number | null;
  companyId: number | null;
  reportingUnitText: string | null;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
  locationName: string | null;
  latitude: string | null;
  longitude: string | null;
  narrative: string | null;
  createdBy: string;
  createdByName: string;
  updatedBy: string | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DrugCaseDetailResponse {
  case: DrugCaseDetail;
  persons: DrugCasePersonRow[];
  phones: DrugCasePhoneRow[];
  sims: DrugCaseSimRow[];
  devices: DrugCaseDeviceRow[];
  vehicles: DrugCaseVehicleRow[];
  seizedItems: DrugSeizedItemRow[];
  locations: DrugCaseLocationRow[];
  personCount: number;
  phoneCount: number;
  simCount: number;
  deviceCount: number;
  vehicleCount: number;
  seizedItemCount: number;
}

export interface DrugCaseCreatePersonInput {
  existingPersonId?: string;
  newPerson?: {
    primaryFullName: string;
    nationality?: string | null;
    dateOfBirth?: string | null;
    notes?: string | null;
    identifiers: Array<{ type: string; value: string; notes?: string | null }>;
  };
  role: string;
  linkedOfficerId?: string | null;
  notes?: string | null;
  phones: Array<{ rawInput: string; firstSeenAt?: string | null; lastSeenAt?: string | null; notes?: string | null }>;
  sims: Array<{ iccid?: string | null; imsi?: string | null; carrier?: string | null; firstSeenAt?: string | null; lastSeenAt?: string | null; notes?: string | null }>;
  devices: Array<{
    brand?: string | null;
    model?: string | null;
    serialNumber?: string | null;
    imei1?: string | null;
    imei2?: string | null;
    firstSeenAt?: string | null;
    lastSeenAt?: string | null;
    notes?: string | null;
  }>;
  vehicles: Array<{
    registrationNumber?: string | null;
    registrationProvince?: string | null;
    vehicleType?: string | null;
    brand?: string | null;
    model?: string | null;
    color?: string | null;
    vin?: string | null;
    firstSeenAt?: string | null;
    lastSeenAt?: string | null;
    notes?: string | null;
  }>;
}

export interface DrugCaseCreateRequest {
  caseNumber: string;
  title: string;
  status?: string;
  arrestDate?: string | null;
  arrestTime?: string | null;
  headquartersId?: number | null;
  regionId?: number | null;
  battalionId?: number | null;
  companyId?: number | null;
  reportingUnitText?: string | null;
  province?: string | null;
  district?: string | null;
  subdistrict?: string | null;
  locationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  narrative?: string | null;
  persons: DrugCaseCreatePersonInput[];
  seizedItems: Array<{
    drugType: string;
    subtype?: string | null;
    quantity?: number | null;
    unit?: string | null;
    weightGrams?: number | null;
    packageCount?: number | null;
    notes?: string | null;
  }>;
  locations: Array<{
    name?: string | null;
    addressText?: string | null;
    province?: string | null;
    district?: string | null;
    subdistrict?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    role: string;
    notes?: string | null;
  }>;
  actorId: string;
  actorName: string;
}

export interface DrugCaseCreateResponse {
  caseId: string;
}

export interface DrugPersonDuplicateCandidate {
  personId: string;
  primaryFullName: string;
  reasons: string[];
}

export interface DrugPersonIdentifierRow {
  id: string;
  personId: string;
  type: string;
  value: string;
  notes: string | null;
}

export interface DrugPersonAliasRow {
  id: string;
  personId: string;
  fullName: string;
  isPrimary: boolean;
}

export interface DrugPersonDetail {
  id: string;
  primaryFullName: string;
  nationality: string | null;
  dateOfBirth: string | null;
  notes: string | null;
}

export interface DrugPersonPhoneRow {
  caseId: string;
  personId: string;
  phoneNumberId: string;
  originalInput: string | null;
  status: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  notes: string | null;
  phoneNumber: DrugPhoneNumberSummary | null;
}

export interface DrugPersonDeviceRow {
  personId: string;
  deviceId: string;
  status: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  notes: string | null;
  device: DrugDeviceSummary | null;
}

export interface DrugPersonVehicleRow {
  personId: string;
  vehicleId: string;
  status: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  notes: string | null;
  vehicle: DrugVehicleSummary | null;
}

export interface DrugPersonDetailResponse {
  person: DrugPersonDetail;
  aliases: DrugPersonAliasRow[];
  identifiers: DrugPersonIdentifierRow[];
  caseCount: number;
  phones: DrugPersonPhoneRow[];
  devices: DrugPersonDeviceRow[];
  vehicles: DrugPersonVehicleRow[];
}

export const drugIntelligenceClient = {
  async getStats(actorId: string): Promise<DrugIntelligenceStats> {
    return (await request<DrugIntelligenceStats>(`/drug-intelligence/stats${toQueryString({ actorId })}`)).data;
  },

  async listCases(actorId: string, query: DrugCaseListQuery): Promise<{ rows: DrugCaseListRow[]; meta: PageMeta }> {
    const { data, meta } = await request<DrugCaseListRow[]>(`/drug-intelligence/cases${toQueryString({ actorId, ...query })}`);
    return { rows: data, meta: meta ?? { page: 1, pageSize: data.length, total: data.length, totalPages: 1 } };
  },

  async getCase(caseId: string, actorId: string): Promise<DrugCaseDetailResponse> {
    return (await request<DrugCaseDetailResponse>(`/drug-intelligence/cases/${encodeURIComponent(caseId)}${toQueryString({ actorId })}`)).data;
  },

  async createCase(body: DrugCaseCreateRequest): Promise<DrugCaseCreateResponse> {
    return (await requestPost<DrugCaseCreateResponse>("/drug-intelligence/cases", body)).data;
  },

  async getPersonDetail(personId: string, actorId: string): Promise<DrugPersonDetailResponse> {
    return (await request<DrugPersonDetailResponse>(`/drug-intelligence/persons/${encodeURIComponent(personId)}${toQueryString({ actorId })}`)).data;
  },

  async checkPersonDuplicate(input: {
    actorId: string;
    primaryFullName: string;
    dateOfBirth?: string | null;
    identifiers: Array<{ type: string; value: string }>;
  }): Promise<{ candidates: DrugPersonDuplicateCandidate[] }> {
    return (await requestPost<{ candidates: DrugPersonDuplicateCandidate[] }>("/drug-intelligence/persons/check-duplicate", input)).data;
  },

  async checkPhoneExists(actorId: string, rawInput: string): Promise<{ exists: boolean; phoneNumber: DrugPhoneNumberSummary | null }> {
    return (
      await request<{ exists: boolean; phoneNumber: DrugPhoneNumberSummary | null }>(
        `/drug-intelligence/phones/check${toQueryString({ actorId, rawInput })}`
      )
    ).data;
  },

  async checkDeviceExists(
    actorId: string,
    imei1: string | null,
    serialNumber: string | null
  ): Promise<{ exists: boolean; device: DrugDeviceSummary | null }> {
    return (
      await request<{ exists: boolean; device: DrugDeviceSummary | null }>(
        `/drug-intelligence/devices/check${toQueryString({ actorId, imei1: imei1 ?? undefined, serialNumber: serialNumber ?? undefined })}`
      )
    ).data;
  },
};

export { ApiClientError } from "@/lib/ui/api_client";
