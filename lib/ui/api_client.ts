/**
 * Dashboard API client (Phase 14).
 *
 * The single layer through which the UI talks to the Phase 13 REST API. It
 * only CONSUMES the existing endpoints (no business logic is reimplemented
 * here) and unwraps their `{ data, meta }` / `{ error }` envelopes into typed
 * results, throwing a typed ApiClientError on failure so React Query hooks and
 * ErrorState can render friendly messages + retry.
 *
 * Pure fetch wrappers over the browser Fetch API — usable in client
 * components. No React, no globals.
 */

/** Officer summary row (list/search). Mirrors the API's Officer projection. */
export interface OfficerSummary {
  officerId: string;
  rank: string;
  firstName: string;
  lastName: string;
  currentPosition: string | null;
  currentUnit: string | null;
  phone: string | null;
  careerYears: number;
  qualityScore: number | null;
  knowledgeScore: number | null;
  region: string | null;
  confidence: number | null;
  /**
   * Phase 24B-3: the resolved portrait for this row, via the single sanctioned
   * batch resolver (lib/server/officer_portrait_service.ts) — NOT the legacy
   * Officer.driveFileId/thumbnailUrl (Phase 23B: those are unreliable and never
   * used). Present on list/search rows; optional only because callers that
   * construct an OfficerSummary by hand (e.g. tests) may omit it.
   */
  driveFileId?: string | null;
  thumbnailUrl?: string | null;
  webViewUrl?: string | null;
  /** Which resolver tier produced the portrait — "PLACEHOLDER" when none was found. */
  portraitSource?: string;
}

/** Drive photo identity, as returned by the officer detail endpoint. */
export interface OfficerPhoto {
  driveFileId: string | null;
  thumbnailUrl: string | null;
  webViewUrl: string | null;
}

export interface TimelineEntry {
  sequence: number;
  year: string;
  yearValue: number | null;
  position: string;
  unit: string | null;
  /** Phase 23A: per-row rank + provenance/verification (additive). */
  rank?: string | null;
  source?: string | null;
  verified?: string;
}

/** Phase 23A: additional contact channels. */
export interface OfficerContact {
  email: string | null;
  lineId: string | null;
  facebookUrl: string | null;
}

/** Phase 23A: one education row. */
export interface EducationEntry {
  id: number;
  year: string | null;
  institution: string;
  degree: string | null;
  notes: string | null;
}

/** Phase 23A: one training row. */
export interface TrainingEntry {
  id: number;
  year: string | null;
  course: string;
  organization: string | null;
  notes: string | null;
}

/** Full officer profile (GET /officers/{id}). */
export interface OfficerProfile {
  officer: {
    id: string;
    rank: string;
    firstName: string;
    lastName: string;
    currentPosition: string | null;
    currentUnit: string | null;
    phone: string | null;
    careerYears: number;
    region: string | null;
    confidence: number | null;
  };
  photo: OfficerPhoto;
  /** Phase 23A: additive. */
  contact?: OfficerContact;
  timeline: TimelineEntry[];
  phones: string[];
  /** Phase 23A: additive. */
  education?: EducationEntry[];
  training?: TrainingEntry[];
  quality: { qualityScore: number | null; knowledgeScore: number | null };
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  match?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PageMeta;
}

export interface UnitCount {
  unit: string;
  officerCount: number;
}
export interface RankCount {
  rank: string;
  officerCount: number;
}

export interface Statistics {
  totalOfficers: number;
  averageCareerYears: number;
  averageQuality: number;
  regions: number;
  units: number;
  timelines: number;
  duplicatePhones: number;
  duplicateNames: number;
}

export interface HealthStatus {
  status: string;
  database: string;
  version: string;
  timestamp: string;
}

/** Text match modes the API supports. */
export type MatchMode = "contains" | "startsWith" | "exact";

/** Officer list/search query params (all optional except paging defaults). */
export interface OfficerQuery {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  rank?: string;
  unit?: string;
  region?: string;
  minQuality?: number;
  minCareerYears?: number;
  /** Phase 20C: Organization master-data filters (helper references — additive). */
  headquartersId?: number;
  regionId?: number;
  battalionId?: number;
  companyId?: number;
  /** Phase 26B Part 6 Part M: new Officers-list filters. */
  verificationStatus?: string;
  hasPortrait?: boolean;
  hasPhone?: boolean;
}

export interface SearchQuery extends OfficerQuery {
  match?: MatchMode;
  name?: string;
  phone?: string;
  position?: string;
}

/** Phase 26B Part B: Global Search query — one free-text `q` plus paging/sort (no per-field inputs, no match mode). */
export interface GlobalSearchQuery {
  q: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/** Typed error carrying the API's code + status so the UI can react (e.g. 503 → "backend unavailable"). */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

interface ApiEnvelope<T> {
  data?: T;
  meta?: PageMeta;
  error?: { code: string; message: string; details?: unknown };
}

/** Serializes a query object to a URLSearchParams string, dropping undefined/empty values. */
function toQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

/** Core fetch + envelope unwrap. Throws ApiClientError on any non-2xx or error envelope. */
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
    throw new ApiClientError(
      err?.message ?? `Request failed (${response.status})`,
      response.status,
      err?.code ?? "REQUEST_FAILED",
      err?.details
    );
  }

  return { data: body.data as T, meta: body.meta };
}

/** Phase 23A: PATCH + envelope unwrap, mirroring `request` but for a JSON body write. */
async function requestPatch<T>(path: string, body: unknown): Promise<{ data: T }> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: "PATCH",
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
    throw new ApiClientError(
      err?.message ?? `Request failed (${response.status})`,
      response.status,
      err?.code ?? "REQUEST_FAILED",
      err?.details
    );
  }

  return { data: parsed.data as T };
}

/** Phase 23A: the batched-save request body — mirrors OfficerProfileSaveInput server-side. */
export interface OfficerProfileSaveRequest {
  profile?: {
    rank?: string;
    firstName?: string;
    lastName?: string;
    currentPosition?: string | null;
    currentUnit?: string | null;
    phone?: string | null;
    email?: string | null;
    lineId?: string | null;
    facebookUrl?: string | null;
    /** Phase 26B Part 5 Part C/I: structured Current Organization hierarchy. */
    headquartersId?: number | null;
    regionId?: number | null;
    battalionId?: number | null;
    companyId?: number | null;
    nickname?: string | null;
    /** Phase 26B Part 5 Part G: Personal Information. */
    dateOfBirth?: string | null;
    bloodGroup?: string | null;
    rh?: string | null;
    maritalStatus?: string | null;
    children?: number | null;
    homeProvince?: string | null;
    shirtSize?: string | null;
    nationality?: string | null;
    /** Phase 26B Part 5 Part O: optional additional fields. */
    citizenId?: string | null;
    passportNumber?: string | null;
    employeeNumber?: string | null;
    emergencyContact?: string | null;
    emergencyPhone?: string | null;
    addressSummary?: string | null;
    currentProvince?: string | null;
    religion?: string | null;
    educationLevel?: string | null;
    weightKg?: number | null;
    heightCm?: number | null;
    uniformShoeSize?: string | null;
    hatSize?: string | null;
    jacketSize?: string | null;
  };
  timeline?: Array<{
    sequence: number;
    year: string;
    yearValue: number | null;
    rank: string | null;
    position: string;
    /** Phase 41 Part 1: structured Position Level — additive alongside the free-text `position` above (never merged). */
    positionLevel?: string | null;
    unit: string | null;
    source: string | null;
    verified: string;
    /** Phase 26B Part 3: structured date model — additive alongside `year`/`yearValue` above. */
    day: number | null;
    month: number | null;
    yearBE: number | null;
    appointmentCycle?: number | null;
    isPresent: boolean;
    /** Phase 26B Part C: structured org hierarchy — additive alongside `unit` above. */
    headquartersId: number | null;
    regionId: number | null;
    battalionId: number | null;
    companyId: number | null;
    /** Phase 26B Part 5 Part D/H/M: verification triad — additive alongside the existing `verified` above. */
    verificationStatus: string | null;
    verifiedBy: string | null;
    verifiedDate: string | null;
    verificationRemark: string | null;
  }>;
  education?: Array<{ year: string | null; institution: string; degree: string | null; notes: string | null }>;
  training?: Array<{ year: string | null; course: string; organization: string | null; notes: string | null }>;
  /** Phase 28A: Career Intelligence Foundation — one salary-step result per Buddhist-Era year. */
  salaryHistory?: Array<{ yearBE: number; salaryStep: number; remarks: string | null }>;
  /** Phase 44: Personnel Capability Intelligence — replace-all skill list. Dates are DD/MM/YYYY (พ.ศ.) strings or null. */
  skills?: Array<{
    skillId: number;
    levelId: number | null;
    yearsExperience: number | null;
    certificateNumber: string | null;
    issuingOrganization: string | null;
    issueDate: string | null;
    expiryDate: string | null;
    verified: boolean;
    verifiedBy: string | null;
    verifiedDate: string | null;
    availableForDeployment: boolean;
    remarks: string | null;
  }>;
}

export interface OfficerProfileSaveResponse {
  officerId: string;
  profileUpdated: boolean;
  timelineRowCount: number | null;
  educationRowCount: number | null;
  trainingRowCount: number | null;
  salaryHistoryRowCount: number | null;
  skillRowCount: number | null;
}

export const apiClient = {
  /** Phase 26B Part 6 Part S: the shared Headquarters/Division/Battalion/Company snapshot, for every page's org-hierarchy filter dropdowns. */
  async getOrganizationTree(): Promise<import("@/lib/organization/org_tree").OrgTree> {
    const { data } = await request<import("@/lib/organization/org_tree").OrgTree>("/organization/tree");
    return data;
  },

  async listOfficers(query: OfficerQuery = {}): Promise<PaginatedResult<OfficerSummary>> {
    const { data, meta } = await request<OfficerSummary[]>(`/officers${toQueryString(query)}`);
    return { data, meta: meta ?? { page: 1, pageSize: data.length, total: data.length, totalPages: 1 } };
  },

  async searchOfficers(query: SearchQuery): Promise<PaginatedResult<OfficerSummary>> {
    const { data, meta } = await request<OfficerSummary[]>(`/search${toQueryString(query)}`);
    return { data, meta: meta ?? { page: 1, pageSize: data.length, total: data.length, totalPages: 1 } };
  },

  /** Phase 26B Part B: Global Search — one free-text query spanning every supported field. */
  async globalSearch(query: GlobalSearchQuery): Promise<PaginatedResult<OfficerSummary>> {
    const { data, meta } = await request<OfficerSummary[]>(`/search/global${toQueryString(query)}`);
    return { data, meta: meta ?? { page: 1, pageSize: data.length, total: data.length, totalPages: 1 } };
  },

  async getOfficer(id: string): Promise<OfficerProfile> {
    const { data } = await request<OfficerProfile>(`/officers/${encodeURIComponent(id)}`);
    return data;
  },

  /** Phase 23A: batched save for the Officer Profile Workspace. */
  async saveOfficerProfile(id: string, body: OfficerProfileSaveRequest): Promise<OfficerProfileSaveResponse> {
    const { data } = await requestPatch<OfficerProfileSaveResponse>(`/officers/${encodeURIComponent(id)}`, body);
    return data;
  },

  async listUnits(): Promise<UnitCount[]> {
    return (await request<UnitCount[]>("/units")).data;
  },

  async listRanks(): Promise<RankCount[]> {
    return (await request<RankCount[]>("/ranks")).data;
  },

  async getStatistics(): Promise<Statistics> {
    return (await request<Statistics>("/statistics")).data;
  },

  async getHealth(): Promise<HealthStatus> {
    return (await request<HealthStatus>("/health")).data;
  },
};
