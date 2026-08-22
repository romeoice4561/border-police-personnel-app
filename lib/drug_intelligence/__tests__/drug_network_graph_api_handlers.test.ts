/**
 * Handler-level permission tests for the DI-5 Network Intelligence API
 * surface (Section 6/27 — drug.read is the floor).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugNetworkGraphService } from "@/lib/drug_intelligence/drug_network_graph_service";
import { handleDrugGraphNeighborhood, handleDrugGraphPath } from "@/lib/drug_intelligence/drug_network_graph_api_handlers";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "NET-API-TEST",
    title: "คดีทดสอบ API ผังความเชื่อมโยง",
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

async function seedOnePersonCase(db: InMemoryDatabaseClient) {
  const caseService = new DrugCaseService({ db });
  const result = await caseService.createCase(
    baseCase({
      persons: [
        {
          newPerson: { primaryFullName: "ทดสอบ เอพีไอ", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    })
  );
  const personRows = await db.drugCasePerson.findMany({ where: { caseId: result.caseId } });
  return { caseId: result.caseId, personId: (personRows[0] as { personId: string }).personId };
}

test("network: officer (no drug.* permissions) is REJECTED with 403", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId } = await seedOnePersonCase(db);
  const graph = new DrugNetworkGraphService(db);

  const request = requestWithSession(`http://localhost/api/drug-intelligence/network?actorId=mock:1101700123456&entityType=PERSON&entityId=${personId}&depth=1`);
  const response = await handleDrugGraphNeighborhood(graph, new URL(request.url).searchParams, request);
  assert.equal(response.status, 403);
});

test("network: commander (drug.read only) CAN view the network — read-only, same bar as search", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId } = await seedOnePersonCase(db);
  const graph = new DrugNetworkGraphService(db);

  const request = requestWithSession(`http://localhost/api/drug-intelligence/network?actorId=mock:bpp414&entityType=PERSON&entityId=${personId}&depth=1`);
  const response = await handleDrugGraphNeighborhood(graph, new URL(request.url).searchParams, request);
  assert.equal(response.status, 200);
});

test("network: missing session cookie is REJECTED with 401", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId } = await seedOnePersonCase(db);
  const graph = new DrugNetworkGraphService(db);

  const request = new Request(`http://localhost/api/drug-intelligence/network?actorId=mock:admin&entityType=PERSON&entityId=${personId}&depth=1`);
  const response = await handleDrugGraphNeighborhood(graph, new URL(request.url).searchParams, request);
  assert.equal(response.status, 401);
});

test("network: unknown entityId returns 404, never a raw DB error", async () => {
  const db = new InMemoryDatabaseClient();
  const graph = new DrugNetworkGraphService(db);

  const request = requestWithSession("http://localhost/api/drug-intelligence/network?actorId=mock:admin&entityType=PERSON&entityId=nonexistent&depth=1");
  const response = await handleDrugGraphNeighborhood(graph, new URL(request.url).searchParams, request);
  assert.equal(response.status, 404);
  const body = await response.json();
  assert.ok(!JSON.stringify(body).includes("Prisma"), "must never leak a raw DB/Prisma error to the client");
});

test("network: invalid depth (e.g. 3) is rejected with 400, server-side, never silently clamped past validation", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId } = await seedOnePersonCase(db);
  const graph = new DrugNetworkGraphService(db);

  const request = requestWithSession(`http://localhost/api/drug-intelligence/network?actorId=mock:admin&entityType=PERSON&entityId=${personId}&depth=3`);
  const response = await handleDrugGraphNeighborhood(graph, new URL(request.url).searchParams, request);
  assert.equal(response.status, 400);
});

test("network: commander sees masked node labels, admin (drug.edit) sees full values", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const result = await caseService.createCase(
    baseCase({
      persons: [
        {
          newPerson: { primaryFullName: "มาสก์ ทดสอบ", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [{ rawInput: "0812223333", firstSeenAt: null, lastSeenAt: null, notes: null }],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    })
  );
  // Focus on the PERSON (always a real string cuid — DrugCaseService explicitly assigns
  // `id: personId` when creating a person, unlike find-or-create entity paths such as
  // findOrCreatePhoneNumber which rely on Prisma's schema default and get a real string
  // cuid only in production Postgres) so the URL round-trip below stays realistic; the
  // PHONE node discovered in this person's 1-hop neighborhood is what we assert on.
  const personRows = await db.drugCasePerson.findMany({ where: { caseId: result.caseId } });
  const personId = (personRows[0] as { personId: string }).personId;
  const graph = new DrugNetworkGraphService(db);

  const commanderRequest = requestWithSession(`http://localhost/api/drug-intelligence/network?actorId=mock:bpp414&entityType=PERSON&entityId=${personId}&depth=1`);
  const commanderResponse = await handleDrugGraphNeighborhood(graph, new URL(commanderRequest.url).searchParams, commanderRequest);
  const commanderBody = (await commanderResponse.json()) as { data: { nodes: Array<{ type: string; label: string }> } };
  const commanderPhoneNode = commanderBody.data.nodes.find((n) => n.type === "PHONE")!;
  assert.ok(commanderPhoneNode, "expected a PHONE node in the person's 1-hop neighborhood");
  assert.doesNotMatch(commanderPhoneNode.label, /812223333/);

  const adminRequest = requestWithSession(`http://localhost/api/drug-intelligence/network?actorId=mock:admin&entityType=PERSON&entityId=${personId}&depth=1`);
  const adminResponse = await handleDrugGraphNeighborhood(graph, new URL(adminRequest.url).searchParams, adminRequest);
  const adminBody = (await adminResponse.json()) as { data: { nodes: Array<{ type: string; label: string }> } };
  const adminPhoneNode = adminBody.data.nodes.find((n) => n.type === "PHONE")!;
  assert.match(adminPhoneNode.label, /812223333/);
});

test("path: officer is REJECTED with 403", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId } = await seedOnePersonCase(db);
  const graph = new DrugNetworkGraphService(db);

  const request = requestWithSession(`http://localhost/api/drug-intelligence/network/path?actorId=mock:1101700123456&fromType=PERSON&fromId=${personId}&toType=PERSON&toId=${personId}`);
  const response = await handleDrugGraphPath(graph, new URL(request.url).searchParams, request);
  assert.equal(response.status, 403);
});

test("path: commander CAN request a path", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const result = await caseService.createCase(
    baseCase({
      persons: [
        { newPerson: { primaryFullName: "เส้นทาง เอ", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] },
        { newPerson: { primaryFullName: "เส้นทาง บี", nationality: null, dateOfBirth: null, notes: null, identifiers: [] }, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] },
      ],
    })
  );
  const personRows = await db.drugCasePerson.findMany({ where: { caseId: result.caseId } });
  const [a, b] = personRows.map((r) => (r as { personId: string }).personId);
  const graph = new DrugNetworkGraphService(db);

  const request = requestWithSession(`http://localhost/api/drug-intelligence/network/path?actorId=mock:bpp414&fromType=PERSON&fromId=${a}&toType=PERSON&toId=${b}`);
  const response = await handleDrugGraphPath(graph, new URL(request.url).searchParams, request);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { found: boolean } };
  assert.equal(body.data.found, true);
});

test("path: invalid maxDepth beyond the ceiling is rejected with 400", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId } = await seedOnePersonCase(db);
  const graph = new DrugNetworkGraphService(db);

  const request = requestWithSession(`http://localhost/api/drug-intelligence/network/path?actorId=mock:admin&fromType=PERSON&fromId=${personId}&toType=PERSON&toId=${personId}&maxDepth=99`);
  const response = await handleDrugGraphPath(graph, new URL(request.url).searchParams, request);
  assert.equal(response.status, 400);
});
