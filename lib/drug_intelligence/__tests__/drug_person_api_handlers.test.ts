/**
 * Handler-level permission tests for the DI-2 Person/Matching/Review/Merge
 * API surface (Phase DI-2, Section 20 — "อย่าให้ drug.read merge ได้").
 *
 * Builds real Request objects (with the session cookie DI-1's
 * assertDrugIntelligencePermission checks for) and exercises the handlers
 * directly against the in-memory fake DatabaseClient — no running server,
 * matching this codebase's established handler-testing pattern.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugPersonMergeService } from "@/lib/drug_intelligence/drug_person_merge_service";
import { DrugPersonMatchReviewService } from "@/lib/drug_intelligence/drug_person_match_review_service";
import { DrugPersonMatchingService } from "@/lib/drug_intelligence/drug_person_matching_service";
import { DrugPersonProfileService } from "@/lib/drug_intelligence/drug_person_profile_service";
import {
  handleDrugPersonMerge,
  handleDrugPersonMergePreview,
  handleDrugMatchReviewDecide,
  handleDrugMatchReviewQueue,
  handleDrugPersonProfile,
  handleDrugPersonProfileUpdate,
  handleDrugPersonMatchCandidatesForDraft,
} from "@/lib/drug_intelligence/drug_person_api_handlers";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "PERM-TEST",
    title: "คดีทดสอบสิทธิ์",
    status: "OPEN",
    arrestDate: null,
    arrestTime: null,
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: null,
    province: null,
    district: null,
    subdistrict: null,
    locationName: null,
    latitude: null,
    longitude: null,
    narrative: null,
    persons: [],
    seizedItems: [],
    locations: [],
    actorId: "mock:admin",
    actorName: "Administrator",
    ...overrides,
  };
}

function requestWithSession(url: string, init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("cookie", `${SESSION_COOKIE_NAME}=test-session`);
  return new Request(url, { ...init, headers });
}

async function seedTwoPersons(db: InMemoryDatabaseClient) {
  const caseService = new DrugCaseService({ db });
  const caseA = await caseService.createCase(baseCase({ caseNumber: "PERM-A", persons: [{ newPerson: { primaryFullName: "A", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] }));
  const caseB = await caseService.createCase(baseCase({ caseNumber: "PERM-B", persons: [{ newPerson: { primaryFullName: "B", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }] }));
  const personAId = ((await db.drugCasePerson.findMany({ where: { caseId: caseA.caseId } }))[0] as { personId: string }).personId;
  const personBId = ((await db.drugCasePerson.findMany({ where: { caseId: caseB.caseId } }))[0] as { personId: string }).personId;
  return { personAId, personBId };
}

test("merge: commander (drug.read only) is REJECTED with 403 — never allowed to merge", async () => {
  const db = new InMemoryDatabaseClient();
  const { personAId, personBId } = await seedTwoPersons(db);
  const mergeService = new DrugPersonMergeService(db);

  const request = requestWithSession("http://localhost/api/drug-intelligence/persons/merge", {
    method: "POST",
    body: JSON.stringify({ actorId: "mock:bpp414", actorName: "Commander BPP414", survivorPersonId: personAId, mergedPersonId: personBId }),
  });
  const response = await handleDrugPersonMerge(mergeService, request);
  assert.equal(response.status, 403);

  const mergedRow = await db.drugPerson.findUnique({ where: { id: personBId } });
  assert.equal(mergedRow?.status, "ACTIVE", "a rejected merge attempt must never write anything");
});

test("merge: admin (drug.admin) succeeds", async () => {
  const db = new InMemoryDatabaseClient();
  const { personAId, personBId } = await seedTwoPersons(db);
  const mergeService = new DrugPersonMergeService(db);

  const request = requestWithSession("http://localhost/api/drug-intelligence/persons/merge", {
    method: "POST",
    body: JSON.stringify({ actorId: "mock:admin", actorName: "Administrator", survivorPersonId: personAId, mergedPersonId: personBId }),
  });
  const response = await handleDrugPersonMerge(mergeService, request);
  assert.equal(response.status, 201);
});

test("merge preview: commander is REJECTED with 403", async () => {
  const db = new InMemoryDatabaseClient();
  const { personAId, personBId } = await seedTwoPersons(db);
  const mergeService = new DrugPersonMergeService(db);

  const request = requestWithSession(
    `http://localhost/api/drug-intelligence/persons/merge/preview?actorId=mock:bpp414&survivorPersonId=${personAId}&mergedPersonId=${personBId}`
  );
  const response = await handleDrugPersonMergePreview(mergeService, new URL(request.url).searchParams, request);
  assert.equal(response.status, 403);
});

test("review decide: commander (drug.read only) is REJECTED with 403 — can see duplicate warnings but never record a decision", async () => {
  const db = new InMemoryDatabaseClient();
  const { personAId, personBId } = await seedTwoPersons(db);
  const reviewService = new DrugPersonMatchReviewService(db);

  const request = requestWithSession("http://localhost/api/drug-intelligence/review/duplicates/decide", {
    method: "POST",
    body: JSON.stringify({ actorId: "mock:bpp414", actorName: "Commander BPP414", personAId, personBId, decision: "NOT_SAME" }),
  });
  const response = await handleDrugMatchReviewDecide(reviewService, request);
  assert.equal(response.status, 403);

  const reviews = await db.drugPersonMatchReview.findMany({ where: {} });
  assert.equal(reviews.length, 0);
});

test("review decide: admin (drug.edit via drug.admin's full permission set) succeeds", async () => {
  const db = new InMemoryDatabaseClient();
  const { personAId, personBId } = await seedTwoPersons(db);
  const reviewService = new DrugPersonMatchReviewService(db);

  const request = requestWithSession("http://localhost/api/drug-intelligence/review/duplicates/decide", {
    method: "POST",
    body: JSON.stringify({ actorId: "mock:admin", actorName: "Administrator", personAId, personBId, decision: "NOT_SAME" }),
  });
  const response = await handleDrugMatchReviewDecide(reviewService, request);
  assert.equal(response.status, 201);
});

test("review queue: commander (drug.read) CAN view the queue — only deciding/merging requires more", async () => {
  const db = new InMemoryDatabaseClient();
  const matchingService = new DrugPersonMatchingService(db);

  const request = requestWithSession("http://localhost/api/drug-intelligence/review/duplicates?actorId=mock:bpp414");
  const response = await handleDrugMatchReviewQueue(matchingService, "mock:bpp414", request);
  assert.equal(response.status, 200);
});

test("person profile: officer (no drug.* permissions at all) is REJECTED with 403", async () => {
  const db = new InMemoryDatabaseClient();
  const { personAId } = await seedTwoPersons(db);
  const profileService = new DrugPersonProfileService(db);

  const request = requestWithSession(`http://localhost/api/drug-intelligence/persons/${personAId}/profile?actorId=mock:1101700123456`);
  const response = await handleDrugPersonProfile(profileService, personAId, "mock:1101700123456", request);
  assert.equal(response.status, 403);
});

test("person profile update: commander (drug.read only) is REJECTED with 403 — viewing profile is fine, editing is not", async () => {
  const db = new InMemoryDatabaseClient();
  const { personAId } = await seedTwoPersons(db);
  const profileService = new DrugPersonProfileService(db);

  const viewRequest = requestWithSession(`http://localhost/api/drug-intelligence/persons/${personAId}/profile?actorId=mock:bpp414`);
  const viewResponse = await handleDrugPersonProfile(profileService, personAId, "mock:bpp414", viewRequest);
  assert.equal(viewResponse.status, 200, "commander should be able to VIEW a profile");

  const editRequest = requestWithSession(`http://localhost/api/drug-intelligence/persons/${personAId}/profile`, {
    method: "PATCH",
    body: JSON.stringify({ actorId: "mock:bpp414", actorName: "Commander BPP414", notes: "should not be allowed" }),
  });
  const editResponse = await handleDrugPersonProfileUpdate(profileService, personAId, editRequest);
  assert.equal(editResponse.status, 403);
});

test("merge: missing session cookie is REJECTED with 401 regardless of actor", async () => {
  const db = new InMemoryDatabaseClient();
  const { personAId, personBId } = await seedTwoPersons(db);
  const mergeService = new DrugPersonMergeService(db);

  const request = new Request("http://localhost/api/drug-intelligence/persons/merge", {
    method: "POST",
    body: JSON.stringify({ actorId: "mock:admin", actorName: "Administrator", survivorPersonId: personAId, mergedPersonId: personBId }),
  });
  const response = await handleDrugPersonMerge(mergeService, request);
  assert.equal(response.status, 401);
});

test("check-duplicate-candidates: officer (no drug.* permissions) is REJECTED with 403", async () => {
  const db = new InMemoryDatabaseClient();
  const matchingService = new DrugPersonMatchingService(db);

  const request = requestWithSession("http://localhost/api/drug-intelligence/persons/check-duplicate-candidates", {
    method: "POST",
    body: JSON.stringify({ actorId: "mock:1101700123456", primaryFullName: "ทดสอบ", identifiers: [] }),
  });
  const response = await handleDrugPersonMatchCandidatesForDraft(matchingService, request);
  assert.equal(response.status, 403);
});

test("check-duplicate-candidates: admin (drug.create) succeeds and returns explainable signals for a real identifier collision", async () => {
  const db = new InMemoryDatabaseClient();
  const { personAId } = await seedTwoPersons(db);
  const matchingService = new DrugPersonMatchingService(db);

  // Give personA a THAI_ID so the draft check below can collide with it.
  const { DrugPersonRepository } = await import("@/lib/database/repositories/drug_person_repository");
  const personRepo = new DrugPersonRepository(db);
  await personRepo.addIdentifier(personAId, "THAI_ID", "3100900112233", null, "mock:admin");

  const request = requestWithSession("http://localhost/api/drug-intelligence/persons/check-duplicate-candidates", {
    method: "POST",
    body: JSON.stringify({ actorId: "mock:admin", primaryFullName: "someone new", identifiers: [{ type: "THAI_ID", value: "3100900112233" }] }),
  });
  const response = await handleDrugPersonMatchCandidatesForDraft(matchingService, request);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { candidates: Array<{ personId: string; confidence: string }> } };
  assert.equal(body.data.candidates.length, 1);
  assert.equal(body.data.candidates[0].personId, personAId);
  assert.equal(body.data.candidates[0].confidence, "HIGH");
});
