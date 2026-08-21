/**
 * Drug Intelligence API handlers (Phase DI-1).
 *
 * The framework-agnostic core of GET/POST /api/drug-intelligence/cases:
 * takes a DrugCaseService + a raw Request/URLSearchParams and returns a Web
 * Response. The route handler under app/api/drug-intelligence/ is a thin
 * adapter that builds the container and delegates here — unit-testable with
 * a fake service and no running server.
 *
 * Authorization (Section 20 — "ห้ามใช้แนวคิดว่า authenticated = เห็นทุกอย่าง"):
 * server-side enforcement mirrors Manual Personnel Entry's
 * assertManualEntryCreatePermission exactly (this codebase's established
 * pattern for a module where session state lives in browser storage, not a
 * real server session) — when AUTH_ENFORCED, require the presence cookie,
 * resolve the acting user via actorId against the AuthBackend, then require
 * the specific permission (drug.read for GET, drug.create for POST).
 */

import { z } from "zod";
import { badRequest, conflict, jsonError, jsonOk, notFound } from "@/lib/api/api_response";
import type { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import type { DrugStatsService } from "@/lib/drug_intelligence/drug_stats_service";
import { drugCaseCreateSchema, drugCaseListQuerySchema } from "@/lib/drug_intelligence/drug_case_api_schemas";
import { DrugDuplicatePersonError, DrugCaseNotFoundError, DrugPersonNotFoundError } from "@/lib/drug_intelligence/drug_case_types";
import { AUTH_ENFORCED, SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { getAuthUserById } from "@/lib/auth/mock_auth_backend";
import { hasPermission, type Permission } from "@/lib/auth/roles";

function zodDetails(error: z.ZodError): unknown {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

function cookieValue(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) return rest.join("=");
  }
  return undefined;
}

/** Enforces `permission` for `actorId` when AUTH_ENFORCED. Returns an error Response or null when the request may proceed. */
export async function assertDrugIntelligencePermission(request: Request, actorId: string, permission: Permission): Promise<Response | null> {
  if (!AUTH_ENFORCED) return null;

  const session = cookieValue(request, SESSION_COOKIE_NAME);
  if (!session) return jsonError("UNAUTHENTICATED", "Authentication required", 401);

  const user = await getAuthUserById(actorId);
  if (!user || !user.isActive) return jsonError("UNAUTHENTICATED", "Invalid actor", 401);
  if (!hasPermission(user.permissions, permission)) return jsonError("FORBIDDEN", `Missing permission: ${permission}`, 403);
  return null;
}

const actorSchema = z.object({
  actorId: z.string().trim().min(1, "actorId is required"),
  actorName: z.string().trim().min(1, "actorName is required"),
});

/** POST /api/drug-intelligence/cases — create a new case. */
export async function handleDrugCaseCreate(service: DrugCaseService, request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON");
  }

  const fieldsParsed = drugCaseCreateSchema.safeParse(body);
  if (!fieldsParsed.success) return badRequest("Invalid drug case request", zodDetails(fieldsParsed.error));

  const actorParsed = actorSchema.safeParse(body);
  if (!actorParsed.success) return badRequest("Invalid drug case request", zodDetails(actorParsed.error));

  const denied = await assertDrugIntelligencePermission(request, actorParsed.data.actorId, "drug.create");
  if (denied) return denied;

  try {
    const result = await service.createCase({ ...fieldsParsed.data, ...actorParsed.data });
    return jsonOk(result, undefined, 201);
  } catch (error) {
    if (error instanceof DrugDuplicatePersonError) {
      return conflict("A matching person already exists", { personIndex: error.personIndex, candidates: error.candidates });
    }
    throw error;
  }
}

/** GET /api/drug-intelligence/cases — list cases (Section 16). */
export async function handleDrugCaseList(service: DrugCaseService, searchParams: URLSearchParams, actorId: string | null, rawHeaders: Request): Promise<Response> {
  if (!actorId) return jsonError("BAD_REQUEST", "actorId query parameter is required", 400);

  const denied = await assertDrugIntelligencePermission(rawHeaders, actorId, "drug.read");
  if (denied) return denied;

  const queryParsed = drugCaseListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!queryParsed.success) return badRequest("Invalid list query", zodDetails(queryParsed.error));

  const { page, pageSize, arrestDateFrom, arrestDateTo, ...rest } = queryParsed.data;
  const result = await service.listCases({
    page,
    pageSize,
    ...rest,
    arrestDateFrom: arrestDateFrom ? new Date(arrestDateFrom) : undefined,
    arrestDateTo: arrestDateTo ? new Date(arrestDateTo) : undefined,
  });
  return jsonOk(result.rows, { page, pageSize, total: result.total, totalPages: Math.max(1, Math.ceil(result.total / pageSize)) });
}

/** GET /api/drug-intelligence/cases/{id} — case detail (Section 18). */
export async function handleDrugCaseDetail(service: DrugCaseService, caseId: string, actorId: string | null, request: Request): Promise<Response> {
  if (!actorId) return jsonError("BAD_REQUEST", "actorId query parameter is required", 400);

  const denied = await assertDrugIntelligencePermission(request, actorId, "drug.read");
  if (denied) return denied;

  try {
    const result = await service.getCase(caseId);
    return jsonOk(result);
  } catch (error) {
    if (error instanceof DrugCaseNotFoundError) return notFound(error.message);
    throw error;
  }
}

const personDuplicateCheckSchema = z.object({
  actorId: z.string().trim().min(1),
  primaryFullName: z.string().trim().max(500).default(""),
  // Nullable AND optional: the real-time check hook (useDrugPersonDuplicateCheck)
  // sends `dateOfBirth: null` whenever the draft's date field is empty
  // (its input type is `string | null`, never simply omitted) — matching
  // every other nullable field's convention in this module.
  dateOfBirth: z.string().trim().nullable().optional(),
  identifiers: z
    .array(z.object({ type: z.string().trim().min(1), value: z.string().trim().min(1) }))
    .default([]),
});

/**
 * POST /api/drug-intelligence/persons/check-duplicate — Section 8's
 * real-time pre-submit duplicate check. Requires drug.create (the same
 * capability that would eventually create the person) — a drug.read-only
 * user never needs to probe for duplicates since they can't create anyway.
 */
export async function handleDrugPersonDuplicateCheck(service: DrugCaseService, request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON");
  }

  const parsed = personDuplicateCheckSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid duplicate-check request", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.create");
  if (denied) return denied;

  const candidates = await service.checkPersonDuplicate({
    identifiers: parsed.data.identifiers,
    primaryFullName: parsed.data.primaryFullName,
    dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : null,
  });
  return jsonOk({ candidates });
}

/** GET /api/drug-intelligence/phones/check?rawInput=...&actorId=... — Section 9's real-time phone-reuse indicator. */
export async function handleDrugPhoneCheck(service: DrugCaseService, searchParams: URLSearchParams, request: Request): Promise<Response> {
  const actorId = searchParams.get("actorId");
  const rawInput = searchParams.get("rawInput");
  if (!actorId) return jsonError("BAD_REQUEST", "actorId query parameter is required", 400);
  if (!rawInput) return jsonError("BAD_REQUEST", "rawInput query parameter is required", 400);

  const denied = await assertDrugIntelligencePermission(request, actorId, "drug.create");
  if (denied) return denied;

  const existing = await service.checkPhoneExists(rawInput);
  return jsonOk({ exists: existing !== null, phoneNumber: existing });
}

/** GET /api/drug-intelligence/devices/check?imei1=...&serialNumber=...&actorId=... — Section 10's real-time IMEI-reuse indicator. */
export async function handleDrugDeviceCheck(service: DrugCaseService, searchParams: URLSearchParams, request: Request): Promise<Response> {
  const actorId = searchParams.get("actorId");
  const imei1 = searchParams.get("imei1");
  const serialNumber = searchParams.get("serialNumber");
  if (!actorId) return jsonError("BAD_REQUEST", "actorId query parameter is required", 400);
  if (!imei1 && !serialNumber) return jsonError("BAD_REQUEST", "imei1 or serialNumber query parameter is required", 400);

  const denied = await assertDrugIntelligencePermission(request, actorId, "drug.create");
  if (denied) return denied;

  const existing = await service.checkDeviceExists(imei1, serialNumber);
  return jsonOk({ exists: existing !== null, device: existing });
}

/** GET /api/drug-intelligence/persons/{id} — Section 18's Person Detail Drawer. Requires drug.read. */
export async function handleDrugPersonDetail(service: DrugCaseService, personId: string, actorId: string | null, request: Request): Promise<Response> {
  if (!actorId) return jsonError("BAD_REQUEST", "actorId query parameter is required", 400);

  const denied = await assertDrugIntelligencePermission(request, actorId, "drug.read");
  if (denied) return denied;

  try {
    const result = await service.getPersonDetail(personId);
    return jsonOk(result);
  } catch (error) {
    if (error instanceof DrugPersonNotFoundError) return notFound(error.message);
    throw error;
  }
}

/** GET /api/drug-intelligence/stats — Section 4's landing-page KPI aggregate. */
export async function handleDrugStats(service: DrugStatsService, actorId: string | null, request: Request): Promise<Response> {
  if (!actorId) return jsonError("BAD_REQUEST", "actorId query parameter is required", 400);

  const denied = await assertDrugIntelligencePermission(request, actorId, "drug.read");
  if (denied) return denied;

  const stats = await service.getStats();
  return jsonOk(stats);
}
