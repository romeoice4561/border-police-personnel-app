/**
 * DI-8.2B — hotspot context service batch evidence.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugGeoHotspotContextService } from "@/lib/drug_intelligence/drug_geo_hotspot_context_service";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "HS-001",
    title: "hotspot",
    status: "OPEN",
    arrestDate: new Date("2026-01-15"),
    arrestTime: "14:30",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: "กก.ตชด.44",
    province: "ชุมพร",
    district: "ท่าแซะ",
    subdistrict: null,
    locationName: null,
    latitude: 10.5,
    longitude: 99.18,
    narrative: "t",
    persons: [],
    seizedItems: [],
    locations: [],
    actorId: "mock:admin",
    actorName: "Administrator",
    ...overrides,
  };
}

test("shared person+phone across hotspot cases is DIRECT evidence", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  const caseA = await cases.createCase(baseCase({ caseNumber: "DI-TEST-001", latitude: 10.5, longitude: 99.18 }));
  const caseB = await cases.createCase(
    baseCase({ caseNumber: "DI-TEST-002", latitude: 10.501, longitude: 99.181, arrestDate: new Date("2026-02-01") }),
  );

  await db.drugPerson.create({ data: { id: "p-shared", primaryFullName: "สมชาย", sex: "UNKNOWN", createdBy: "mock:admin" } });
  await db.drugCasePerson.create({ data: { id: "cp1", caseId: caseA.caseId, personId: "p-shared", role: "SUSPECT" } });
  await db.drugCasePerson.create({ data: { id: "cp2", caseId: caseB.caseId, personId: "p-shared", role: "SUSPECT" } });

  await db.drugPhoneNumber.create({
    data: { id: "ph1", normalizedNumber: "66811111111", createdBy: "mock:admin", notes: null },
  });
  await db.drugCasePhone.create({
    data: {
      id: "cph1",
      caseId: caseA.caseId,
      phoneNumberId: "ph1",
      personId: null,
      originalInput: "0811111111",
      status: "ACTIVE",
      firstSeenAt: null,
      lastSeenAt: null,
      recordedBy: "mock:admin",
      notes: null,
    },
  });
  await db.drugCasePhone.create({
    data: {
      id: "cph2",
      caseId: caseB.caseId,
      phoneNumberId: "ph1",
      personId: null,
      originalInput: "0811111111",
      status: "ACTIVE",
      firstSeenAt: null,
      lastSeenAt: null,
      recordedBy: "mock:admin",
      notes: null,
    },
  });

  const result = await new DrugGeoHotspotContextService(db).load([caseA.caseId, caseB.caseId], { canViewFull: true });
  assert.equal(result.analysis.linkedPairCount, 1);
  assert.ok(result.analysis.pairs[0]!.evidenceLabels.includes("บุคคลเดียวกัน"));
  assert.ok(result.analysis.pairs[0]!.evidenceLabels.includes("หมายเลขโทรศัพท์เดียวกัน"));
  assert.equal(result.analysis.counts.uniquePersonCount, 1);
  assert.equal(result.analysis.counts.uniquePhoneCount, 1);
});

test("two hotspot cases with no shared entities → proximity only", async () => {
  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  const caseA = await cases.createCase(baseCase({ caseNumber: "NEAR-1" }));
  const caseB = await cases.createCase(baseCase({ caseNumber: "NEAR-2", arrestDate: new Date("2026-02-01") }));
  await db.drugPerson.create({ data: { id: "p1", primaryFullName: "A", sex: "UNKNOWN", createdBy: "mock:admin" } });
  await db.drugPerson.create({ data: { id: "p2", primaryFullName: "B", sex: "UNKNOWN", createdBy: "mock:admin" } });
  await db.drugCasePerson.create({ data: { id: "cp1", caseId: caseA.caseId, personId: "p1", role: "SUSPECT" } });
  await db.drugCasePerson.create({ data: { id: "cp2", caseId: caseB.caseId, personId: "p2", role: "SUSPECT" } });

  const result = await new DrugGeoHotspotContextService(db).load([caseA.caseId, caseB.caseId], { canViewFull: false });
  assert.equal(result.analysis.linkedPairCount, 0);
  assert.equal(result.analysis.proximityOnlyPairCount, 1);
});
