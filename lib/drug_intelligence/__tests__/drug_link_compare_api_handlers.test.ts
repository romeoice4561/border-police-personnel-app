/**
 * Handler-level tests for GET /api/drug-intelligence/network/compare (LC-2A).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugLinkCompareService } from "@/lib/drug_intelligence/drug_link_compare_service";
import { handleDrugLinkCompare } from "@/lib/drug_intelligence/drug_link_compare_api_handlers";
import { drugLinkCompareQuerySchema } from "@/lib/drug_intelligence/drug_link_compare_api_schemas";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "LC-API",
    title: "คดีทดสอบ API เปรียบเทียบ",
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

async function seedPair(db: InMemoryDatabaseClient) {
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      persons: [
        {
          newPerson: { primaryFullName: "ทดสอบ เอพีไอ", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
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
  const personId = (await db.drugPerson.findMany({}))[0].id;
  const phoneId = (await db.drugPhoneNumber.findMany({}))[0].id;
  return { personId, phoneId };
}

test("compare API: officer without drug.read is 403", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId, phoneId } = await seedPair(db);
  const service = new DrugLinkCompareService(db);
  const request = requestWithSession(
    `http://localhost/api/drug-intelligence/network/compare?actorId=mock:1101700123456&aType=PERSON&aId=${personId}&bType=PHONE&bId=${phoneId}`
  );
  const response = await handleDrugLinkCompare(service, new URL(request.url).searchParams, request);
  assert.equal(response.status, 403);
});

test("compare API: missing session is 401", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId, phoneId } = await seedPair(db);
  const service = new DrugLinkCompareService(db);
  const request = new Request(
    `http://localhost/api/drug-intelligence/network/compare?actorId=mock:admin&aType=PERSON&aId=${personId}&bType=PHONE&bId=${phoneId}`
  );
  const response = await handleDrugLinkCompare(service, new URL(request.url).searchParams, request);
  assert.equal(response.status, 401);
});

test("compare API: commander with drug.read can compare", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId, phoneId } = await seedPair(db);
  const service = new DrugLinkCompareService(db);
  const request = requestWithSession(
    `http://localhost/api/drug-intelligence/network/compare?actorId=mock:bpp414&aType=PERSON&aId=${personId}&bType=PHONE&bId=${phoneId}`
  );
  const response = await handleDrugLinkCompare(service, new URL(request.url).searchParams, request);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { interpretation: { kind: string }; pairs: Array<{ connectionKind: string }> } };
  assert.equal(body.data.interpretation.kind, "QUERY");
  assert.equal(body.data.pairs[0].connectionKind, "DIRECT");
});

test("compare API: LOCATION endpoint is 400", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId } = await seedPair(db);
  const service = new DrugLinkCompareService(db);
  const request = requestWithSession(
    `http://localhost/api/drug-intelligence/network/compare?actorId=mock:admin&aType=LOCATION&aId=loc-1&bType=PERSON&bId=${personId}`
  );
  const response = await handleDrugLinkCompare(service, new URL(request.url).searchParams, request);
  assert.equal(response.status, 400);
});

test("compare API: duplicate entity is 400", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId } = await seedPair(db);
  const service = new DrugLinkCompareService(db);
  const request = requestWithSession(
    `http://localhost/api/drug-intelligence/network/compare?actorId=mock:admin&aType=PERSON&aId=${personId}&bType=PERSON&bId=${personId}`
  );
  const response = await handleDrugLinkCompare(service, new URL(request.url).searchParams, request);
  assert.equal(response.status, 400);
});

test("compare API: missing entity is 404", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId } = await seedPair(db);
  const service = new DrugLinkCompareService(db);
  const request = requestWithSession(
    `http://localhost/api/drug-intelligence/network/compare?actorId=mock:admin&aType=PERSON&aId=${personId}&bType=VEHICLE&bId=missing-vehicle`
  );
  const response = await handleDrugLinkCompare(service, new URL(request.url).searchParams, request);
  assert.equal(response.status, 404);
  const body = await response.json();
  assert.ok(!JSON.stringify(body).includes("Prisma"));
});

test("compare API: commander phone labels stay masked", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId, phoneId } = await seedPair(db);
  const phone = (await db.drugPhoneNumber.findMany({}))[0];
  const service = new DrugLinkCompareService(db);
  const request = requestWithSession(
    `http://localhost/api/drug-intelligence/network/compare?actorId=mock:bpp414&aType=PERSON&aId=${personId}&bType=PHONE&bId=${phoneId}`
  );
  const response = await handleDrugLinkCompare(service, new URL(request.url).searchParams, request);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { slots: Array<{ key: string; label: string | null }> } };
  const phoneSlot = body.data.slots.find((s) => s.key === "B")!;
  assert.notEqual(phoneSlot.label, phone.normalizedNumber);
  assert.match(String(phoneSlot.label), /x/i);
});

test("compare API: admin sees the unmasked phone on the DTO", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId, phoneId } = await seedPair(db);
  const phone = (await db.drugPhoneNumber.findMany({}))[0];
  const service = new DrugLinkCompareService(db);
  const request = requestWithSession(
    `http://localhost/api/drug-intelligence/network/compare?actorId=mock:admin&aType=PERSON&aId=${personId}&bType=PHONE&bId=${phoneId}`
  );
  const response = await handleDrugLinkCompare(service, new URL(request.url).searchParams, request);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { slots: Array<{ key: string; label: string | null }> } };
  const phoneSlot = body.data.slots.find((s) => s.key === "B")!;
  assert.equal(phoneSlot.label, phone.normalizedNumber);
});

test("compare API: invalid actor is 401", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId, phoneId } = await seedPair(db);
  const service = new DrugLinkCompareService(db);
  const request = requestWithSession(
    `http://localhost/api/drug-intelligence/network/compare?actorId=mock:ghost&aType=PERSON&aId=${personId}&bType=PHONE&bId=${phoneId}`
  );
  const response = await handleDrugLinkCompare(service, new URL(request.url).searchParams, request);
  assert.equal(response.status, 401);
});

test("compare API: missing actorId / missing A / C without id are 400", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId, phoneId } = await seedPair(db);
  const service = new DrugLinkCompareService(db);
  const cases = [
    `http://localhost/api/drug-intelligence/network/compare?aType=PERSON&aId=${personId}&bType=PHONE&bId=${phoneId}`,
    `http://localhost/api/drug-intelligence/network/compare?actorId=mock:admin&bType=PHONE&bId=${phoneId}`,
    `http://localhost/api/drug-intelligence/network/compare?actorId=mock:admin&aType=PERSON&aId=${personId}&bType=PHONE&bId=${phoneId}&cType=VEHICLE`,
    `http://localhost/api/drug-intelligence/network/compare?actorId=mock:admin&aType=PERSON&aId=${personId}&bType=PHONE&bId=${phoneId}&cId=veh-1`,
    `http://localhost/api/drug-intelligence/network/compare?actorId=mock:admin&aType=PERSON&aId=&bType=PHONE&bId=${phoneId}`,
    `http://localhost/api/drug-intelligence/network/compare?actorId=mock:admin&aType=PERSON&aId=${"x".repeat(501)}&bType=PHONE&bId=${phoneId}`,
  ];
  for (const url of cases) {
    const request = requestWithSession(url);
    const response = await handleDrugLinkCompare(service, new URL(request.url).searchParams, request);
    assert.equal(response.status, 400, url);
  }
});

test("compare API: duplicate A/C is 400", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId, phoneId } = await seedPair(db);
  const service = new DrugLinkCompareService(db);
  const request = requestWithSession(
    `http://localhost/api/drug-intelligence/network/compare?actorId=mock:admin&aType=PERSON&aId=${personId}&bType=PHONE&bId=${phoneId}&cType=PERSON&cId=${personId}`
  );
  const response = await handleDrugLinkCompare(service, new URL(request.url).searchParams, request);
  assert.equal(response.status, 400);
});

test("compare API: maxDepth query parameter cannot override the server depth bound", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "LC-API-2HOP",
      persons: [
        {
          newPerson: { primaryFullName: "เอสองฮอป", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [],
          devices: [],
          vehicles: [],
        },
        {
          newPerson: { primaryFullName: "บีสองฮอป", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
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
  const [a, b] = await db.drugPerson.findMany({});
  const service = new DrugLinkCompareService(db);
  const request = requestWithSession(
    `http://localhost/api/drug-intelligence/network/compare?actorId=mock:admin&aType=PERSON&aId=${a.id}&bType=PERSON&bId=${b.id}&maxDepth=1`
  );
  const response = await handleDrugLinkCompare(service, new URL(request.url).searchParams, request);
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    data: { pairs: Array<{ connectionKind: string; hopCount: number | null }>; bounds: { maxPathDepth: number } };
  };
  assert.equal(body.data.bounds.maxPathDepth, 3);
  assert.equal(body.data.pairs[0].connectionKind, "INDIRECT");
  assert.equal(body.data.pairs[0].hopCount, 2);
});

test("compare API: extra and repeated query params stay bounded and do not mutate", async () => {
  const db = new InMemoryDatabaseClient();
  const { personId, phoneId } = await seedPair(db);
  const beforePhones = (await db.drugPhoneNumber.findMany({})).length;
  const service = new DrugLinkCompareService(db);
  const request = requestWithSession(
    `http://localhost/api/drug-intelligence/network/compare?actorId=mock:admin&aType=PERSON&aId=not-a-person&aId=${personId}&bType=PHONE&bId=${phoneId}&unknown=1&maxDepth=99`
  );
  const response = await handleDrugLinkCompare(service, new URL(request.url).searchParams, request);
  assert.equal(response.status, 200);
  assert.equal((await db.drugPhoneNumber.findMany({})).length, beforePhones);
  const body = await response.json();
  assert.ok(!JSON.stringify(body).includes("Prisma"));
});

test("compare query schema strips maxDepth and rejects partial C", () => {
  const ok = drugLinkCompareQuerySchema.safeParse({
    actorId: "mock:admin",
    aType: "PERSON",
    aId: "1",
    bType: "PHONE",
    bId: "2",
    maxDepth: "99",
  });
  assert.equal(ok.success, true);
  if (ok.success) assert.equal("maxDepth" in ok.data, false);

  const partialC = drugLinkCompareQuerySchema.safeParse({
    actorId: "mock:admin",
    aType: "PERSON",
    aId: "1",
    bType: "PHONE",
    bId: "2",
    cType: "VEHICLE",
  });
  assert.equal(partialC.success, false);
});
