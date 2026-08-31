/**
 * Relationship Search API handler tests (Phase 1B).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugIntelligenceRelationshipQueryService } from "@/lib/drug_intelligence/drug_intelligence_relationship_query_service";
import { handleDrugRelationshipSearch } from "@/lib/drug_intelligence/drug_relationship_query_api_handlers";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "REL-API-1",
    title: "คดีทดสอบ API ความเชื่อมโยง",
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

function requestWithSession(url: string): Request {
  const headers = new Headers();
  headers.set("cookie", `${SESSION_COOKIE_NAME}=test-session`);
  return new Request(url, { headers });
}

test("relationship API: officer without drug.read is 403", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugIntelligenceRelationshipQueryService(db);
  const request = requestWithSession(
    "http://localhost/api/drug-intelligence/search/relationships?actorId=mock:1101700123456&actorName=Officer&sourceType=PHONE&sourceId=x&relationId=phone_found_in_case&targetType=CASE"
  );
  const response = await handleDrugRelationshipSearch(service, new URL(request.url).searchParams, request);
  assert.equal(response.status, 403);
});

test("relationship API: missing session is 401", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugIntelligenceRelationshipQueryService(db);
  const request = new Request(
    "http://localhost/api/drug-intelligence/search/relationships?actorId=mock:admin&sourceType=PHONE&sourceId=x&relationId=phone_found_in_case&targetType=CASE"
  );
  const response = await handleDrugRelationshipSearch(service, new URL(request.url).searchParams, request);
  assert.equal(response.status, 401);
});

test("relationship API: commander can query PERSON→PHONE and gets QUERY interpretation", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      persons: [
        {
          newPerson: { primaryFullName: "API ความเชื่อม", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [{ rawInput: "0899998888", firstSeenAt: null, lastSeenAt: null, notes: null }],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    })
  );
  const persons = await db.drugPerson.findMany({});
  const service = new DrugIntelligenceRelationshipQueryService(db);

  const request = requestWithSession(
    `http://localhost/api/drug-intelligence/search/relationships?actorId=mock:bpp414&actorName=Commander&sourceType=PERSON&sourceId=${encodeURIComponent(String(persons[0].id))}&relationId=person_related_phone&targetType=PHONE`
  );
  const response = await handleDrugRelationshipSearch(service, new URL(request.url).searchParams, request);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.interpretation.kind, "QUERY");
  assert.ok(body.data.summary.total >= 1);
});

test("relationship API: unsupported relation id is 400", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugIntelligenceRelationshipQueryService(db);
  const request = requestWithSession(
    "http://localhost/api/drug-intelligence/search/relationships?actorId=mock:admin&sourceType=PHONE&sourceId=x&relationId=phone_called_phone&targetType=PHONE"
  );
  const response = await handleDrugRelationshipSearch(service, new URL(request.url).searchParams, request);
  assert.equal(response.status, 400);
});

test("relationship API: writes relationship_search_performed audit without raw phone", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "REL-API-AUDIT",
      persons: [
        {
          newPerson: { primaryFullName: "Audit Rel", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [{ rawInput: "0876543210", firstSeenAt: null, lastSeenAt: null, notes: null }],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    })
  );
  const persons = await db.drugPerson.findMany({});
  const service = new DrugIntelligenceRelationshipQueryService(db);
  const request = requestWithSession(
    `http://localhost/api/drug-intelligence/search/relationships?actorId=mock:admin&actorName=Administrator&sourceType=PERSON&sourceId=${encodeURIComponent(String(persons[0].id))}&relationId=person_related_phone&targetType=PHONE`
  );
  const response = await handleDrugRelationshipSearch(service, new URL(request.url).searchParams, request);
  assert.equal(response.status, 200);
  const audits = await db.drugAuditLog.findMany({ where: { action: "relationship_search_performed" } });
  assert.equal(audits.length, 1);
  assert.ok(!(audits[0] as { detail: string }).detail.includes("0876543210"));
});
