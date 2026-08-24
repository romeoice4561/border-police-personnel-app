/**
 * Drug Intelligence Person/Matching/Review/Merge API handlers (Phase DI-2).
 *
 * Same framework-agnostic handler pattern as drug_case_api_handlers.ts —
 * takes a service + raw Request and returns a Web Response, unit-testable
 * with a fake service and no running server. Reuses
 * `assertDrugIntelligencePermission` from drug_case_api_handlers.ts rather
 * than re-implementing the cookie/actor/permission check a second time.
 *
 * Permission mapping (Section 20 — "อย่าให้ drug.read merge ได้"):
 *   - view profile/directory/potential-duplicates → drug.read
 *   - edit profile/alias/identifier, record a NOT_SAME/CONFIRMED_DUPLICATE
 *     review decision → drug.edit
 *   - merge preview + merge → drug.admin (the strictest, unused-until-now
 *     permission DI-1 reserved for exactly this kind of destructive-
 *     sensitive action)
 */

import { z } from "zod";
import { badRequest, conflict, jsonError, jsonOk, notFound } from "@/lib/api/api_response";
import { assertDrugIntelligencePermission } from "@/lib/drug_intelligence/drug_case_api_handlers";
import type { DrugPersonProfileService, DrugPersonDirectoryService } from "@/lib/drug_intelligence/drug_person_profile_service";
import type { DrugPersonMatchingService } from "@/lib/drug_intelligence/drug_person_matching_service";
import type { DrugPersonMergeService } from "@/lib/drug_intelligence/drug_person_merge_service";
import type { DrugPersonMatchReviewService } from "@/lib/drug_intelligence/drug_person_match_review_service";
import { DrugPersonNotFoundError } from "@/lib/drug_intelligence/drug_case_types";
import {
  DrugPersonAlreadyMergedError,
  DrugPersonNotFoundForMergeError,
  DrugCannotMergeSamePersonError,
} from "@/lib/drug_intelligence/drug_person_merge_service";
import { DrugPersonMatchReviewAlreadyDecidedError } from "@/lib/drug_intelligence/drug_person_match_review_service";
import {
  drugPersonDirectoryQuerySchema,
  drugPersonProfileUpdateSchema,
  drugPersonAddAliasSchema,
  drugPersonAddIdentifierSchema,
  drugPersonMatchReviewDecisionSchema,
  drugPersonMergeRequestSchema,
  drugPersonMergePreviewQuerySchema,
  drugPersonMatchCandidatesForDraftSchema,
  drugPersonAddNetworkRoleSchema,
  drugPersonUpdateNetworkRoleStatusSchema,
  drugPersonAddNetworkMembershipSchema,
  drugNetworkGroupCreateSchema,
  drugNetworkGroupSearchSchema,
} from "@/lib/drug_intelligence/drug_person_api_schemas";
import { DrugPersonNetworkRoleRepository } from "@/lib/database/repositories/drug_person_network_role_repository";
import { DrugNetworkGroupRepository } from "@/lib/database/repositories/drug_network_group_repository";
import { DrugAuditLogRepository } from "@/lib/database/repositories/drug_audit_log_repository";
import type { DatabaseClient } from "@/lib/database/database_types";

function zodDetails(error: z.ZodError): unknown {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

async function parseJsonBody(request: Request): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false, response: badRequest("Request body must be valid JSON") };
  }
}

/** GET /api/drug-intelligence/persons?query=...&page=...&pageSize=...&actorId=... — Section 7-9's Person Directory. */
export async function handleDrugPersonDirectoryList(service: DrugPersonDirectoryService, searchParams: URLSearchParams, request: Request): Promise<Response> {
  const parsed = drugPersonDirectoryQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return badRequest("Invalid directory query", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.read");
  if (denied) return denied;

  const { page, pageSize, query } = parsed.data;
  const result = await service.list({ page, pageSize, query });
  return jsonOk(result.rows, { page, pageSize, total: result.total, totalPages: Math.max(1, Math.ceil(result.total / pageSize)) });
}

/** GET /api/drug-intelligence/persons/{id}/profile?actorId=... — Section 4-6's full Person Intelligence Profile. */
export async function handleDrugPersonProfile(service: DrugPersonProfileService, personId: string, actorId: string | null, request: Request): Promise<Response> {
  if (!actorId) return jsonError("BAD_REQUEST", "actorId query parameter is required", 400);

  const denied = await assertDrugIntelligencePermission(request, actorId, "drug.read");
  if (denied) return denied;

  try {
    const result = await service.getProfile(personId);
    return jsonOk(result);
  } catch (error) {
    if (error instanceof DrugPersonNotFoundError) return notFound(error.message);
    throw error;
  }
}

/** GET /api/drug-intelligence/persons/{id}/potential-duplicates?actorId=... — Section 6's Review/Data Quality tab. */
export async function handleDrugPersonPotentialDuplicates(service: DrugPersonProfileService, personId: string, actorId: string | null, request: Request): Promise<Response> {
  if (!actorId) return jsonError("BAD_REQUEST", "actorId query parameter is required", 400);

  const denied = await assertDrugIntelligencePermission(request, actorId, "drug.read");
  if (denied) return denied;

  try {
    const candidates = await service.getPotentialDuplicates(personId);
    return jsonOk({ candidates });
  } catch (error) {
    if (error instanceof DrugPersonNotFoundError) return notFound(error.message);
    throw error;
  }
}

/** PATCH /api/drug-intelligence/persons/{id}/profile — Section 21's profile edit. Requires drug.edit. */
export async function handleDrugPersonProfileUpdate(service: DrugPersonProfileService, personId: string, request: Request): Promise<Response> {
  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = drugPersonProfileUpdateSchema.safeParse(parsedBody.body);
  if (!parsed.success) return badRequest("Invalid profile update", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.edit");
  if (denied) return denied;

  try {
    const { actorId, actorName, dateOfBirth, ...rest } = parsed.data;
    const result = await service.updateProfile(
      personId,
      { ...rest, dateOfBirth: dateOfBirth === undefined ? undefined : dateOfBirth ? new Date(dateOfBirth) : null },
      actorId,
      actorName
    );
    return jsonOk(result);
  } catch (error) {
    if (error instanceof DrugPersonNotFoundError) return notFound(error.message);
    throw error;
  }
}

/** POST /api/drug-intelligence/persons/{id}/aliases — Section 22's "+ เพิ่มชื่ออื่น". Requires drug.edit. */
export async function handleDrugPersonAddAlias(service: DrugPersonProfileService, personId: string, request: Request): Promise<Response> {
  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = drugPersonAddAliasSchema.safeParse(parsedBody.body);
  if (!parsed.success) return badRequest("Invalid alias request", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.edit");
  if (denied) return denied;

  try {
    await service.addAlias(personId, parsed.data.fullName, parsed.data.actorId, parsed.data.actorName);
    return jsonOk({ added: true }, undefined, 201);
  } catch (error) {
    if (error instanceof DrugPersonNotFoundError) return notFound(error.message);
    throw error;
  }
}

/** POST /api/drug-intelligence/persons/{id}/identifiers — Section 23's "+ เพิ่มเลขประจำตัว". Requires drug.edit. Never bypasses the duplicate engine — returns candidates in the response for the UI to warn on. */
export async function handleDrugPersonAddIdentifier(service: DrugPersonProfileService, personId: string, request: Request): Promise<Response> {
  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = drugPersonAddIdentifierSchema.safeParse(parsedBody.body);
  if (!parsed.success) return badRequest("Invalid identifier request", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.edit");
  if (denied) return denied;

  try {
    const result = await service.addIdentifier(
      personId,
      parsed.data.type,
      parsed.data.value,
      parsed.data.notes ?? null,
      parsed.data.actorId,
      parsed.data.actorName
    );
    return jsonOk(result, undefined, 201);
  } catch (error) {
    if (error instanceof DrugPersonNotFoundError) return notFound(error.message);
    throw error;
  }
}

/** GET /api/drug-intelligence/review/duplicates?actorId=... — Section 13's Duplicate Review Queue. Requires drug.read (viewing the queue is fine for commander; only recording a decision or merging needs a higher permission). */
export async function handleDrugMatchReviewQueue(service: DrugPersonMatchingService, actorId: string | null, request: Request): Promise<Response> {
  if (!actorId) return jsonError("BAD_REQUEST", "actorId query parameter is required", 400);

  const denied = await assertDrugIntelligencePermission(request, actorId, "drug.read");
  if (denied) return denied;

  const pairs = await service.findUnresolvedPairs();
  return jsonOk(pairs);
}

/** POST /api/drug-intelligence/review/duplicates/decide — Section 19's "ไม่ใช่บุคคลเดียวกัน"/"ยืนยันว่าซ้ำ". Requires drug.edit (never drug.read — Section 20). */
export async function handleDrugMatchReviewDecide(service: DrugPersonMatchReviewService, request: Request): Promise<Response> {
  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = drugPersonMatchReviewDecisionSchema.safeParse(parsedBody.body);
  if (!parsed.success) return badRequest("Invalid review decision", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.edit");
  if (denied) return denied;

  try {
    const result = await service.recordDecision({
      personAId: parsed.data.personAId,
      personBId: parsed.data.personBId,
      decision: parsed.data.decision,
      signals: parsed.data.signals ?? [],
      notes: parsed.data.notes ?? null,
      actorId: parsed.data.actorId,
      actorName: parsed.data.actorName,
    });
    return jsonOk(result, undefined, 201);
  } catch (error) {
    if (error instanceof DrugPersonNotFoundError) return notFound(error.message);
    if (error instanceof DrugPersonMatchReviewAlreadyDecidedError) return conflict(error.message);
    throw error;
  }
}

/** GET /api/drug-intelligence/persons/merge/preview?survivorPersonId=...&mergedPersonId=...&actorId=... — Section 15's merge preview. Requires drug.admin. */
export async function handleDrugPersonMergePreview(service: DrugPersonMergeService, searchParams: URLSearchParams, request: Request): Promise<Response> {
  const parsed = drugPersonMergePreviewQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return badRequest("Invalid merge preview query", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.admin");
  if (denied) return denied;

  try {
    const preview = await service.preview(parsed.data.survivorPersonId, parsed.data.mergedPersonId);
    return jsonOk(preview);
  } catch (error) {
    if (error instanceof DrugPersonNotFoundForMergeError) return notFound(error.message);
    if (error instanceof DrugCannotMergeSamePersonError) return badRequest(error.message);
    throw error;
  }
}

/** POST /api/drug-intelligence/persons/merge — Section 15's merge execution. Requires drug.admin. */
export async function handleDrugPersonMerge(service: DrugPersonMergeService, request: Request): Promise<Response> {
  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = drugPersonMergeRequestSchema.safeParse(parsedBody.body);
  if (!parsed.success) return badRequest("Invalid merge request", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.admin");
  if (denied) return denied;

  try {
    const result = await service.merge({
      survivorPersonId: parsed.data.survivorPersonId,
      mergedPersonId: parsed.data.mergedPersonId,
      reason: parsed.data.reason ?? null,
      actorId: parsed.data.actorId,
      actorName: parsed.data.actorName,
    });
    return jsonOk(result, undefined, 201);
  } catch (error) {
    if (error instanceof DrugPersonNotFoundForMergeError) return notFound(error.message);
    if (error instanceof DrugCannotMergeSamePersonError) return badRequest(error.message);
    if (error instanceof DrugPersonAlreadyMergedError) return conflict(error.message);
    throw error;
  }
}

/**
 * POST /api/drug-intelligence/persons/check-duplicate-candidates — Section
 * 21/28's Create Case real-time duplicate-candidate check, backed by the
 * Round A matching engine (signals + confidence), never DI-1's simpler
 * check-duplicate endpoint. Requires drug.create (same capability that
 * would eventually create the person — mirrors DI-1's check-duplicate
 * permission exactly).
 */
export async function handleDrugPersonMatchCandidatesForDraft(service: DrugPersonMatchingService, request: Request): Promise<Response> {
  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = drugPersonMatchCandidatesForDraftSchema.safeParse(parsedBody.body);
  if (!parsed.success) return badRequest("Invalid match-candidates request", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.create");
  if (denied) return denied;

  const identity = service.buildIdentityForDraft({
    identifiers: parsed.data.identifiers,
    primaryFullName: parsed.data.primaryFullName,
    dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : null,
    phones: parsed.data.phones,
    deviceImeis: parsed.data.deviceImeis,
    vehicleVins: parsed.data.vehicleVins,
  });
  const candidates = await service.findCandidates(identity);
  return jsonOk({ candidates });
}

// ── DI-7.3: Network Role handlers ─────────────────────────────────────────────

/** POST /api/drug-intelligence/persons/{id}/network-roles — add a role assertion. Requires drug.edit. */
export async function handleAddDrugPersonNetworkRole(db: DatabaseClient, personId: string, request: Request): Promise<Response> {
  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = drugPersonAddNetworkRoleSchema.safeParse(parsedBody.body);
  if (!parsed.success) return badRequest("Invalid network role request", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.edit");
  if (denied) return denied;

  const repo = new DrugPersonNetworkRoleRepository(db);
  const row = await repo.create({
    personId,
    sourceCaseId: parsed.data.sourceCaseId ?? null,
    role: parsed.data.role,
    source: parsed.data.source ?? null,
    verificationStatus: parsed.data.verificationStatus,
    note: parsed.data.note ?? null,
    createdBy: parsed.data.actorId,
    createdByName: parsed.data.actorName,
  });
  await new DrugAuditLogRepository(db).record({
    entityType: "DrugPersonNetworkRole",
    entityId: row.id,
    action: "DRUG_PERSON_NETWORK_ROLE_ADDED",
    actorId: parsed.data.actorId,
    actorName: parsed.data.actorName,
    detail: JSON.stringify({ personId, role: parsed.data.role, source: parsed.data.source ?? null, verificationStatus: row.verificationStatus }),
  });
  return jsonOk(row);
}

/** PATCH /api/drug-intelligence/persons/{id}/network-roles/{roleId} — update verification status. Requires drug.edit. */
export async function handleUpdateDrugPersonNetworkRoleStatus(db: DatabaseClient, roleId: string, request: Request): Promise<Response> {
  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = drugPersonUpdateNetworkRoleStatusSchema.safeParse(parsedBody.body);
  if (!parsed.success) return badRequest("Invalid network role status request", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.edit");
  if (denied) return denied;

  const repo = new DrugPersonNetworkRoleRepository(db);
  const row = await repo.updateVerificationStatus(roleId, parsed.data.verificationStatus);
  await new DrugAuditLogRepository(db).record({
    entityType: "DrugPersonNetworkRole",
    entityId: roleId,
    action: "DRUG_PERSON_NETWORK_ROLE_STATUS_UPDATED",
    actorId: parsed.data.actorId,
    actorName: parsed.data.actorName,
    detail: JSON.stringify({ newStatus: parsed.data.verificationStatus }),
  });
  return jsonOk(row);
}

// ── DI-7.2: Network Group & Membership handlers ───────────────────────────────

/** GET /api/drug-intelligence/network-groups?query=...&actorId=... — search groups. Requires drug.read. */
export async function handleDrugNetworkGroupSearch(db: DatabaseClient, searchParams: URLSearchParams, request: Request): Promise<Response> {
  const parsed = drugNetworkGroupSearchSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return badRequest("Invalid network group search", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.read");
  if (denied) return denied;

  const repo = new DrugNetworkGroupRepository(db);
  const rows = await repo.search(parsed.data.query ?? "");
  return jsonOk(rows);
}

/** POST /api/drug-intelligence/network-groups — create a canonical group. Requires drug.edit (never silently from free text). */
export async function handleDrugNetworkGroupCreate(db: DatabaseClient, request: Request): Promise<Response> {
  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = drugNetworkGroupCreateSchema.safeParse(parsedBody.body);
  if (!parsed.success) return badRequest("Invalid network group create request", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.edit");
  if (denied) return denied;

  const repo = new DrugNetworkGroupRepository(db);
  const row = await repo.create({
    name: parsed.data.name,
    aliases: parsed.data.aliases ?? null,
    description: parsed.data.description ?? null,
    note: parsed.data.note ?? null,
    createdBy: parsed.data.actorId,
  });
  await new DrugAuditLogRepository(db).record({
    entityType: "DrugNetworkGroup",
    entityId: row.id,
    action: "DRUG_NETWORK_GROUP_CREATED",
    actorId: parsed.data.actorId,
    actorName: parsed.data.actorName,
    detail: JSON.stringify({ name: row.name }),
  });
  return jsonOk(row);
}

/** POST /api/drug-intelligence/persons/{id}/network-memberships — add a membership. Requires drug.edit. */
export async function handleAddDrugPersonNetworkMembership(db: DatabaseClient, personId: string, request: Request): Promise<Response> {
  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = drugPersonAddNetworkMembershipSchema.safeParse(parsedBody.body);
  if (!parsed.success) return badRequest("Invalid network membership request", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.edit");
  if (denied) return denied;

  const repo = new DrugNetworkGroupRepository(db);
  let groupId = parsed.data.networkGroupId ?? null;

  if (!groupId && parsed.data.networkGroupName?.trim()) {
    const existing = await repo.search(parsed.data.networkGroupName.trim());
    const exact = existing.find((g) => g.name.toLowerCase() === parsed.data.networkGroupName!.trim().toLowerCase());
    if (exact) {
      groupId = exact.id;
    } else {
      const newGroup = await repo.create({
        name: parsed.data.networkGroupName.trim(),
        aliases: null,
        description: null,
        note: null,
        createdBy: parsed.data.actorId,
      });
      groupId = newGroup.id;
    }
  }

  if (!groupId) return badRequest("Either networkGroupId or networkGroupName must be provided");

  const membership = await repo.addMembership({
    personId,
    networkGroupId: groupId,
    source: parsed.data.source ?? null,
    status: null,
    note: parsed.data.note ?? null,
    firstObservedAt: null,
    lastObservedAt: null,
    createdBy: parsed.data.actorId,
  }) as { id: string; personId: string; networkGroupId: string; [key: string]: unknown };
  await new DrugAuditLogRepository(db).record({
    entityType: "DrugPersonNetworkMembership",
    entityId: membership.id,
    action: "DRUG_PERSON_NETWORK_MEMBERSHIP_ADDED",
    actorId: parsed.data.actorId,
    actorName: parsed.data.actorName,
    detail: JSON.stringify({ personId, networkGroupId: groupId }),
  });
  return jsonOk(membership);
}
