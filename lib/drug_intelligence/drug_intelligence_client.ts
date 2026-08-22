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
  drugCategory: string;
  otherDrugCategoryLabel: string | null;
  measurementKind: string;
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
    drugCategory: string;
    otherDrugCategoryLabel?: string | null;
    measurementKind: string;
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

// ── DI-2 Round B: Person Directory / Profile / Matching / Review / Merge ──

export interface DrugPersonDirectoryRow {
  id: string;
  primaryFullName: string;
  status: string;
  aliasCount: number;
  primaryAlias: string | null;
  identifierPreview: { type: string; value: string } | null;
  caseCount: number;
  phoneCount: number;
  deviceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  hasPotentialDuplicate: boolean;
}

export interface DrugPersonDirectoryQuery {
  page?: number;
  pageSize?: number;
  query?: string;
}

export type DrugMatchSignalStrength = "STRONG" | "MEDIUM" | "WEAK";
export type DrugMatchSignalKind =
  | "IDENTIFIER_THAI_ID"
  | "IDENTIFIER_PASSPORT"
  | "IDENTIFIER_ALIEN_ID"
  | "IDENTIFIER_OTHER"
  | "PHONE_NUMBER"
  | "DEVICE_IMEI"
  | "VEHICLE_VIN"
  | "NAME_EXACT"
  | "ALIAS_MATCH"
  | "DATE_OF_BIRTH"
  | "SAME_CASE";

export interface DrugMatchSignal {
  kind: DrugMatchSignalKind;
  strength: DrugMatchSignalStrength;
  matchedValue: string;
}

export type DrugMatchConfidence = "HIGH" | "MEDIUM" | "LOW";
export type DrugPersonMatchDecisionValue = "CONFIRMED_DUPLICATE" | "NOT_SAME" | "MERGED";

export interface DrugPersonMatchCandidate {
  personId: string;
  primaryFullName: string;
  status: string;
  signals: DrugMatchSignal[];
  confidence: DrugMatchConfidence;
  existingDecision: DrugPersonMatchDecisionValue | null;
}

export interface DrugUnresolvedMatchPair extends DrugPersonMatchCandidate {
  /** The other person in the pair (the matching-engine response calls the queue-row's own `personId` the "B" side). */
  pairPersonId: string;
  pairPersonName: string;
}

export interface DrugCaseLinkSummary {
  caseId: string;
  role: string;
  createdAt: string;
  case: DrugCaseDetail | null;
}

export interface DrugPersonProfileLocationRow {
  id: string;
  locationId: string;
  role: string;
  createdAt: string;
  caseId: string;
  caseNumber: string | null;
  location: DrugLocationSummary | null;
}

export interface DrugPersonSimSummaryRow {
  sim: { id: string; iccid: string | null; imsi: string | null; carrier: string | null } | null;
}

export interface DrugPersonMergeHistoryRow {
  id: string;
  survivorPersonId: string;
  mergedPersonId: string;
  reason: string | null;
  mergedBy: string;
  mergedByName: string;
  mergedAt: string;
}

export interface DrugPersonDataQualityFlag {
  code: "NO_IDENTIFIER" | "NO_SOURCE_CASE" | "CONFLICTING_DOB" | "POTENTIAL_DUPLICATE" | "IDENTIFIER_SHARED";
  detail: string;
}

export interface DrugPersonProfileResponse {
  person: DrugPersonDetail & { status: string; mergedIntoPersonId: string | null; createdAt: string; updatedAt: string };
  aliases: DrugPersonAliasRow[];
  identifiers: DrugPersonIdentifierRow[];
  cases: DrugCaseLinkSummary[];
  phones: DrugPersonPhoneRow[];
  sims: DrugPersonSimSummaryRow[];
  devices: DrugPersonDeviceRow[];
  caseDeviceSightingCount: number;
  vehicles: DrugPersonVehicleRow[];
  caseVehicleSightingCount: number;
  locations: DrugPersonProfileLocationRow[];
  mergeHistory: DrugPersonMergeHistoryRow[];
  firstSeenAt: string;
  lastSeenAt: string;
  dataQuality: DrugPersonDataQualityFlag[];
  counts: { cases: number; phones: number; sims: number; devices: number; vehicles: number; locations: number };
}

export interface DrugPersonProfileUpdateInput {
  actorId: string;
  actorName: string;
  primaryFullName?: string;
  nationality?: string | null;
  dateOfBirth?: string | null;
  notes?: string | null;
}

export interface DrugPersonMergePreview {
  survivorPersonId: string;
  survivorName: string;
  mergedPersonId: string;
  mergedName: string;
  movedCounts: { cases: number; phones: number; sims: number; devices: number; vehicles: number; identifiers: number; aliases: number };
  skippedDuplicateCaseLinks: number;
}

// ── DI-3: Global Intelligence Search types ───────────────────────────────

export type DrugSearchEntityType = "PERSON" | "PHONE" | "SIM" | "DEVICE" | "VEHICLE" | "CASE";
export type DrugSearchQueryClassification = "PERSON_NAME" | "IDENTIFIER" | "PHONE" | "IMEI" | "VEHICLE_REGISTRATION" | "CASE_NUMBER" | "GENERAL_TEXT";
export type DrugSearchMatchedField =
  | "PRIMARY_NAME"
  | "ALIAS"
  | "IDENTIFIER"
  | "PHONE_NUMBER"
  | "ICCID"
  | "IMSI"
  | "IMEI"
  | "SERIAL_NUMBER"
  | "REGISTRATION_NUMBER"
  | "VIN"
  | "CASE_NUMBER"
  | "CASE_TITLE";
export type DrugSearchMatchStrength = "EXACT" | "PARTIAL";

export interface DrugSearchResult {
  entityType: DrugSearchEntityType;
  entityId: string;
  primaryLabel: string;
  secondaryLabel: string | null;
  matchedField: DrugSearchMatchedField;
  matchedValueMasked: string;
  strength: DrugSearchMatchStrength;
  firstSeen: string | null;
  lastSeen: string | null;
  caseCount: number;
  hasPotentialDuplicate: boolean | null;
  canonicalTarget: { entityId: string; primaryLabel: string } | null;
}

export interface DrugSearchGroupedResults {
  query: string;
  classification: DrugSearchQueryClassification;
  totalCount: number;
  groups: Array<{ entityType: DrugSearchEntityType; count: number; results: DrugSearchResult[] }>;
}

export interface DrugSearchFiltersInput {
  entityType?: DrugSearchEntityType;
  dateFrom?: string;
  dateTo?: string;
  province?: string;
  headquartersId?: number;
  regionId?: number;
  battalionId?: number;
  companyId?: number;
  minCaseCount?: number;
}

export interface DrugSearchGroupedQuery extends DrugSearchFiltersInput {
  q: string;
  perGroupLimit?: number;
}

export interface DrugSearchByTypeQuery extends DrugSearchFiltersInput {
  q: string;
  entityType: DrugSearchEntityType;
  page: number;
  pageSize: number;
}

// ── DI-3: Entity Detail types ─────────────────────────────────────────────

export interface DrugPhoneDetailResponse {
  phone: DrugPhoneNumberSummary & { createdBy: string; createdAt: string; notes: string | null };
  caseLinks: Array<DrugCasePhoneRow & { case: DrugCaseDetail | null }>;
  relatedPersons: DrugPersonSummary[];
  sourceCases: DrugCaseDetail[];
  relatedPersonCount: number;
  caseCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface DrugSimDetailResponse {
  sim: { id: string; iccid: string | null; imsi: string | null; carrier: string | null; createdBy: string; createdAt: string; notes: string | null };
  caseLinks: Array<DrugCaseSimRow & { case: DrugCaseDetail | null }>;
  relatedPersons: DrugPersonSummary[];
  sourceCases: DrugCaseDetail[];
  relatedPersonCount: number;
  caseCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface DrugDeviceDetailResponse {
  device: DrugDeviceSummary & { createdBy: string; createdAt: string; notes: string | null };
  personLinks: Array<DrugPersonDeviceRow & { person: DrugPersonSummary | null }>;
  caseLinks: Array<DrugCaseDeviceRow & { case: DrugCaseDetail | null }>;
  relatedPersons: DrugPersonSummary[];
  sourceCases: DrugCaseDetail[];
  relatedPersonCount: number;
  caseCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface DrugVehicleDetailResponse {
  vehicle: DrugVehicleSummary & { createdBy: string; createdAt: string; notes: string | null };
  personLinks: Array<DrugPersonVehicleRow & { person: DrugPersonSummary | null }>;
  caseLinks: Array<DrugCaseVehicleRow & { case: DrugCaseDetail | null }>;
  relatedPersons: DrugPersonSummary[];
  sourceCases: DrugCaseDetail[];
  relatedPersonCount: number;
  caseCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

// ── DI-5: Network Intelligence / Link Analysis types ─────────────────────

export type DrugGraphNodeType = "PERSON" | "PHONE" | "SIM" | "DEVICE" | "VEHICLE" | "CASE" | "LOCATION";

export type DrugGraphRelationshipType =
  | "PERSON_CASE"
  | "PERSON_PHONE"
  | "PERSON_SIM"
  | "PERSON_DEVICE"
  | "PERSON_VEHICLE"
  | "CASE_PHONE"
  | "CASE_SIM"
  | "CASE_DEVICE"
  | "CASE_VEHICLE"
  | "CASE_LOCATION"
  | "SHARED_CASE"
  | "SHARED_PHONE"
  | "SHARED_SIM"
  | "SHARED_DEVICE"
  | "SHARED_VEHICLE";

export type DrugGraphEdgeKind = "DIRECT" | "INFERRED";
export type DrugGraphRiskIndicator = "POTENTIAL_DUPLICATE_PERSON" | "HIGH_CASE_COUNT" | "MERGED_PERSON_HISTORICAL";

export type DrugGraphNodeMetadata =
  | { type: "PERSON"; status: "ACTIVE" | "MERGED"; canonicalTarget: { entityId: string; primaryLabel: string } | null; hasPotentialDuplicate: boolean }
  | { type: "PHONE"; carrier: string | null }
  | { type: "SIM"; imsi: string | null; carrier: string | null }
  | { type: "DEVICE"; brand: string | null; model: string | null }
  | { type: "VEHICLE"; registrationProvince: string | null; brand: string | null; model: string | null; color: string | null }
  | { type: "CASE"; caseNumber: string; status: string; arrestDate: string | null; province: string | null; reportingUnitText: string | null }
  | { type: "LOCATION"; province: string | null; district: string | null };

export interface DrugGraphNode {
  id: string;
  type: DrugGraphNodeType;
  label: string;
  secondaryLabel: string | null;
  maskedLabel: string | null;
  metadata: DrugGraphNodeMetadata;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  caseCount: number;
  riskIndicators: DrugGraphRiskIndicator[];
}

export type DrugGraphEdgeExplanation =
  | { kind: "DIRECT_ROLE"; role: string }
  | { kind: "DIRECT_LINK" }
  | { kind: "SHARED_CASES"; count: number }
  | { kind: "SHARED_PHONE" }
  | { kind: "SHARED_SIM" }
  | { kind: "SHARED_DEVICE" }
  | { kind: "SHARED_VEHICLE" };

export interface DrugGraphEdge {
  id: string;
  source: string;
  target: string;
  relationshipType: DrugGraphRelationshipType;
  edgeKind: DrugGraphEdgeKind;
  evidenceCount: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  sourceCaseIds: string[];
  explanation: DrugGraphEdgeExplanation;
}

export interface DrugGraphNeighborhoodResponse {
  focus: { entityType: DrugGraphNodeType; entityId: string };
  nodes: DrugGraphNode[];
  edges: DrugGraphEdge[];
  truncated: boolean;
}

export interface DrugGraphNeighborhoodQuery {
  entityType: DrugGraphNodeType;
  entityId: string;
  depth?: 1 | 2;
  nodeTypes?: DrugGraphNodeType[];
  relationshipTypes?: DrugGraphRelationshipType[];
  dateFrom?: string;
  dateTo?: string;
  maxNodes?: number;
}

export interface DrugGraphPathStep {
  node: DrugGraphNode;
  viaEdge: DrugGraphEdge | null;
}

export interface DrugGraphPath {
  steps: DrugGraphPathStep[];
  hopCount: number;
}

export interface DrugGraphPathResponse {
  found: boolean;
  paths: DrugGraphPath[];
}

export interface DrugGraphPathQuery {
  fromType: DrugGraphNodeType;
  fromId: string;
  toType: DrugGraphNodeType;
  toId: string;
  maxDepth?: number;
}

// ── DI-6: Repeat Entity Detection & Intelligence Alerts ───────────────────

export type DrugAlertType =
  | "REPEAT_PERSON"
  | "REPEAT_PHONE"
  | "REPEAT_SIM"
  | "REPEAT_DEVICE"
  | "REPEAT_VEHICLE"
  | "REPEAT_CASE_ENTITY"
  | "NEW_NETWORK_CONNECTION"
  | "HIGH_CONFIDENCE_DUPLICATE";

export type DrugAlertSeverity = "INFO" | "NOTICE" | "HIGH";
export type DrugAlertEntityType = "PERSON" | "PHONE" | "SIM" | "DEVICE" | "VEHICLE";
export type DrugAlertStatus = "NEW" | "REVIEWED" | "DISMISSED";

export interface DrugIntelligenceAlert {
  id: string;
  alertType: DrugAlertType;
  severity: DrugAlertSeverity;
  entityType: DrugAlertEntityType;
  entityId: string;
  title: string;
  explanation: string;
  currentCaseId: string | null;
  priorCaseIds: string[];
  relatedPersonIds: string[] | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  occurrenceCount: number;
  dedupeKey: string;
  status: DrugAlertStatus;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  dismissReason: string | null;
  createdAt: string;
}

export interface DrugIntelligenceAlertKpi {
  unreviewed: number;
  highSeverity: number;
  repeatPerson: number;
  repeatPhoneOrSim: number;
  repeatDeviceOrImei: number;
  repeatVehicle: number;
}

export interface DrugAlertListQuery {
  status?: DrugAlertStatus;
  alertType?: DrugAlertType;
  severity?: DrugAlertSeverity;
  entityType?: DrugAlertEntityType;
  currentCaseId?: string;
  dateFrom?: string;
  dateTo?: string;
  query?: string;
  page?: number;
  pageSize?: number;
}

export interface DrugAlertListResponse {
  alerts: DrugIntelligenceAlert[];
  totalCount: number;
  kpi: DrugIntelligenceAlertKpi;
}

export interface DrugAlertQuickCheckResult {
  found: boolean;
  entityType: DrugAlertEntityType;
  entityId: string | null;
  caseCount: number;
  relatedPersonCount: number;
  lastSeenAt: string | null;
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

  // ── DI-2 Round B ──────────────────────────────────────────────────────

  async getPersonDirectory(actorId: string, query: DrugPersonDirectoryQuery): Promise<{ rows: DrugPersonDirectoryRow[]; meta: PageMeta }> {
    const { data, meta } = await request<DrugPersonDirectoryRow[]>(`/drug-intelligence/persons${toQueryString({ actorId, ...query })}`);
    return { rows: data, meta: meta ?? { page: 1, pageSize: data.length, total: data.length, totalPages: 1 } };
  },

  async getPersonProfile(personId: string, actorId: string): Promise<DrugPersonProfileResponse> {
    return (await request<DrugPersonProfileResponse>(`/drug-intelligence/persons/${encodeURIComponent(personId)}/profile${toQueryString({ actorId })}`)).data;
  },

  async updatePersonProfile(personId: string, body: DrugPersonProfileUpdateInput): Promise<DrugPersonDetail> {
    return (await requestPatch<DrugPersonDetail>(`/drug-intelligence/persons/${encodeURIComponent(personId)}/profile`, body)).data;
  },

  async addPersonAlias(personId: string, body: { actorId: string; actorName: string; fullName: string }): Promise<{ added: boolean }> {
    return (await requestPost<{ added: boolean }>(`/drug-intelligence/persons/${encodeURIComponent(personId)}/aliases`, body)).data;
  },

  async addPersonIdentifier(
    personId: string,
    body: { actorId: string; actorName: string; type: string; value: string; notes?: string | null }
  ): Promise<{ candidates: DrugPersonMatchCandidate[] }> {
    return (await requestPost<{ candidates: DrugPersonMatchCandidate[] }>(`/drug-intelligence/persons/${encodeURIComponent(personId)}/identifiers`, body)).data;
  },

  async getPotentialDuplicates(personId: string, actorId: string): Promise<{ candidates: DrugPersonMatchCandidate[] }> {
    return (
      await request<{ candidates: DrugPersonMatchCandidate[] }>(`/drug-intelligence/persons/${encodeURIComponent(personId)}/potential-duplicates${toQueryString({ actorId })}`)
    ).data;
  },

  async getMatchReviewQueue(actorId: string): Promise<DrugUnresolvedMatchPair[]> {
    return (await request<DrugUnresolvedMatchPair[]>(`/drug-intelligence/review/duplicates${toQueryString({ actorId })}`)).data;
  },

  async decideMatchReview(body: {
    actorId: string;
    actorName: string;
    personAId: string;
    personBId: string;
    decision: "CONFIRMED_DUPLICATE" | "NOT_SAME";
    signals?: unknown;
    notes?: string | null;
  }): Promise<{ reviewId: string }> {
    return (await requestPost<{ reviewId: string }>("/drug-intelligence/review/duplicates/decide", body)).data;
  },

  async getMergePreview(actorId: string, survivorPersonId: string, mergedPersonId: string): Promise<DrugPersonMergePreview> {
    return (
      await request<DrugPersonMergePreview>(`/drug-intelligence/persons/merge/preview${toQueryString({ actorId, survivorPersonId, mergedPersonId })}`)
    ).data;
  },

  async mergePersons(body: { actorId: string; actorName: string; survivorPersonId: string; mergedPersonId: string; reason?: string | null }): Promise<{ mergeId: string }> {
    return (await requestPost<{ mergeId: string }>("/drug-intelligence/persons/merge", body)).data;
  },

  /** Section 21/28: Create Case's real-time duplicate-candidate check via the Round A matching engine — distinct from checkPersonDuplicate() above (DI-1's simpler reasons-only check, still used by createCase()'s submit-time block). */
  async checkDuplicateCandidates(body: {
    actorId: string;
    primaryFullName: string;
    dateOfBirth?: string | null;
    identifiers: Array<{ type: string; value: string }>;
    phones?: string[];
    deviceImeis?: string[];
    vehicleVins?: string[];
  }): Promise<{ candidates: DrugPersonMatchCandidate[] }> {
    return (await requestPost<{ candidates: DrugPersonMatchCandidate[] }>("/drug-intelligence/persons/check-duplicate-candidates", body)).data;
  },

  // ── DI-3: Global Intelligence Search ──────────────────────────────────

  async searchGrouped(actorId: string, actorName: string, query: DrugSearchGroupedQuery): Promise<DrugSearchGroupedResults> {
    return (await request<DrugSearchGroupedResults>(`/drug-intelligence/search${toQueryString({ actorId, actorName, ...query })}`)).data;
  },

  async searchByType(actorId: string, query: DrugSearchByTypeQuery): Promise<{ rows: DrugSearchResult[]; meta: PageMeta }> {
    const { data, meta } = await request<DrugSearchResult[]>(`/drug-intelligence/search/by-type${toQueryString({ actorId, ...query })}`);
    return { rows: data, meta: meta ?? { page: 1, pageSize: data.length, total: data.length, totalPages: 1 } };
  },

  async getPhoneDetail(phoneNumberId: string, actorId: string): Promise<DrugPhoneDetailResponse> {
    return (await request<DrugPhoneDetailResponse>(`/drug-intelligence/phones/${encodeURIComponent(phoneNumberId)}${toQueryString({ actorId })}`)).data;
  },

  async getSimDetail(simId: string, actorId: string): Promise<DrugSimDetailResponse> {
    return (await request<DrugSimDetailResponse>(`/drug-intelligence/sims/${encodeURIComponent(simId)}${toQueryString({ actorId })}`)).data;
  },

  async getDeviceDetail(deviceId: string, actorId: string): Promise<DrugDeviceDetailResponse> {
    return (await request<DrugDeviceDetailResponse>(`/drug-intelligence/devices/${encodeURIComponent(deviceId)}${toQueryString({ actorId })}`)).data;
  },

  async getVehicleDetail(vehicleId: string, actorId: string): Promise<DrugVehicleDetailResponse> {
    return (await request<DrugVehicleDetailResponse>(`/drug-intelligence/vehicles/${encodeURIComponent(vehicleId)}${toQueryString({ actorId })}`)).data;
  },

  // ── DI-5: Network Intelligence / Link Analysis ─────────────────────────

  async getNetworkNeighborhood(actorId: string, query: DrugGraphNeighborhoodQuery): Promise<DrugGraphNeighborhoodResponse> {
    return (await request<DrugGraphNeighborhoodResponse>(`/drug-intelligence/network${toQueryString({ actorId, ...query })}`)).data;
  },

  async getNetworkPath(actorId: string, query: DrugGraphPathQuery): Promise<DrugGraphPathResponse> {
    return (await request<DrugGraphPathResponse>(`/drug-intelligence/network/path${toQueryString({ actorId, ...query })}`)).data;
  },

  // ── DI-6: Repeat Entity Detection & Intelligence Alerts ─────────────────

  async listAlerts(actorId: string, query: DrugAlertListQuery): Promise<DrugAlertListResponse> {
    return (await request<DrugAlertListResponse>(`/drug-intelligence/alerts${toQueryString({ actorId, ...query })}`)).data;
  },

  async getAlertsForEntity(actorId: string, entityType: DrugAlertEntityType, entityId: string): Promise<{ alerts: DrugIntelligenceAlert[] }> {
    return (await request<{ alerts: DrugIntelligenceAlert[] }>(`/drug-intelligence/alerts/entity${toQueryString({ actorId, entityType, entityId })}`)).data;
  },

  async getAlertsForCase(actorId: string, caseId: string): Promise<{ alerts: DrugIntelligenceAlert[] }> {
    return (await request<{ alerts: DrugIntelligenceAlert[] }>(`/drug-intelligence/alerts/case${toQueryString({ actorId, caseId })}`)).data;
  },

  async quickCheckPhone(actorId: string, rawInput: string): Promise<DrugAlertQuickCheckResult> {
    return (await request<DrugAlertQuickCheckResult>(`/drug-intelligence/alerts/quick-check${toQueryString({ actorId, entityType: "PHONE", rawInput })}`)).data;
  },

  async quickCheckDevice(actorId: string, imei1: string | null, serialNumber: string | null): Promise<DrugAlertQuickCheckResult> {
    return (
      await request<DrugAlertQuickCheckResult>(
        `/drug-intelligence/alerts/quick-check${toQueryString({ actorId, entityType: "DEVICE", imei1: imei1 ?? undefined, serialNumber: serialNumber ?? undefined })}`
      )
    ).data;
  },

  async quickCheckVehicle(actorId: string, registrationNumber: string | null, registrationProvince: string | null, vin: string | null): Promise<DrugAlertQuickCheckResult> {
    return (
      await request<DrugAlertQuickCheckResult>(
        `/drug-intelligence/alerts/quick-check${toQueryString({
          actorId,
          entityType: "VEHICLE",
          registrationNumber: registrationNumber ?? undefined,
          registrationProvince: registrationProvince ?? undefined,
          vin: vin ?? undefined,
        })}`
      )
    ).data;
  },

  async generateAlerts(actorId: string, actorName: string, caseId: string): Promise<{ alerts: DrugIntelligenceAlert[] }> {
    return (await requestPost<{ alerts: DrugIntelligenceAlert[] }>("/drug-intelligence/alerts/generate", { actorId, actorName, caseId })).data;
  },

  async reviewAlert(alertId: string, actorId: string, actorName: string): Promise<{ alert: DrugIntelligenceAlert }> {
    return (await requestPost<{ alert: DrugIntelligenceAlert }>(`/drug-intelligence/alerts/${encodeURIComponent(alertId)}/review`, { actorId, actorName })).data;
  },

  async dismissAlert(alertId: string, actorId: string, actorName: string, reason: string): Promise<{ alert: DrugIntelligenceAlert }> {
    return (await requestPost<{ alert: DrugIntelligenceAlert }>(`/drug-intelligence/alerts/${encodeURIComponent(alertId)}/dismiss`, { actorId, actorName, reason })).data;
  },

  async reopenAlert(alertId: string, actorId: string, actorName: string): Promise<{ alert: DrugIntelligenceAlert }> {
    return (await requestPost<{ alert: DrugIntelligenceAlert }>(`/drug-intelligence/alerts/${encodeURIComponent(alertId)}/reopen`, { actorId, actorName })).data;
  },
};

export { ApiClientError } from "@/lib/ui/api_client";
