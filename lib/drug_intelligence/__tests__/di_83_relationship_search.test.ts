/**
 * DI-8.3 — Intelligence Search Center / Relationship Search focused tests.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugIntelligenceRelationshipQueryService } from "@/lib/drug_intelligence/drug_intelligence_relationship_query_service";
import { DrugNetworkGraphService } from "@/lib/drug_intelligence/drug_network_graph_service";
import {
  DRUG_REL_SEARCH_MAX_PATHS,
  DRUG_REL_SEARCH_PATH_MAX_DEPTH,
} from "@/lib/drug_intelligence/drug_network_graph_types";
import { getControlledRelation } from "@/lib/drug_intelligence/drug_relationship_query_catalog";
import {
  DrugRelationshipQueryValidationError,
} from "@/lib/drug_intelligence/drug_relationship_query_types";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

const ROOT = process.cwd();

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "DI83-001",
    title: "คดีทดสอบ DI-8.3",
    status: "OPEN",
    arrestDate: new Date("2026-08-01"),
    arrestTime: "21:30",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: "กก.ตชด.44",
    province: "ชุมพร",
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

function person(
  name: string,
  phone?: string,
  extras?: Partial<NonNullable<DrugCaseCreateRequest["persons"]>[number]>
): NonNullable<DrugCaseCreateRequest["persons"]>[number] {
  return {
    newPerson: { primaryFullName: name, nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
    role: "SUSPECT",
    linkedOfficerId: null,
    notes: null,
    phones: phone
      ? [{ rawInput: phone, firstSeenAt: null, lastSeenAt: null, notes: null }]
      : [],
    sims: [],
    devices: [],
    vehicles: [],
    ...extras,
  };
}

describe("DI-8.3 catalog + UX contracts", () => {
  test("all_related overview relations exist for searchable entity types", () => {
    for (const id of [
      "person_all_related",
      "phone_all_related",
      "sim_all_related",
      "device_all_related",
      "vehicle_all_related",
      "case_all_related",
    ]) {
      const rel = getControlledRelation(id);
      assert.ok(rel, id);
      assert.equal(rel!.queryMode, "NEIGHBORHOOD");
      assert.equal(rel!.graphRelationshipType, null);
      assert.equal(rel!.targetOptional, true);
    }
  });

  test("Search Center third mode is Network Graph, not AI placeholder", () => {
    const modeSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_search_mode_switcher.tsx"), "utf8");
    assert.match(modeSrc, /id:\s*"graph"/);
    assert.doesNotMatch(modeSrc, /id:\s*"ai"/);
    assert.match(modeSrc, /\/drug-intelligence\/network/);
  });

  test("General Search card prefills Relationship Search", () => {
    const cardSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_search_result_card.tsx"), "utf8");
    assert.match(cardSrc, /mode:\s*"relationship"/);
    assert.match(cardSrc, /person_all_related/);
    assert.match(cardSrc, /search-open-relationship/);
    assert.match(cardSrc, /di\.connection\.viewConnections/);
  });

  test("results group overview + no-evidence copy + chronology", () => {
    const resultsSrc = readFileSync(
      join(ROOT, "components/drug_intelligence/drug_relationship_search_results.tsx"),
      "utf8"
    );
    assert.match(resultsSrc, /relationship-overview/);
    assert.match(resultsSrc, /relationship-no-evidence/);
    assert.match(resultsSrc, /rel-case-chronology/);
    assert.match(resultsSrc, /di\.rel\.pathNotFound/);
    assert.match(resultsSrc, /data-compact="true"/);
    assert.match(resultsSrc, /rel-toggle-details/);
    assert.match(resultsSrc, /rel-expanded-evidence/);
    assert.match(resultsSrc, /rel-compact-why/);
    assert.match(resultsSrc, /di\.rel\.expandDetails/);
    assert.match(resultsSrc, /di\.rel\.originLabel/);
    assert.match(resultsSrc, /relationship-group-/);
    const dictSrc = readFileSync(join(ROOT, "lib/i18n/dictionary.ts"), "utf8");
    assert.match(dictSrc, /ยังไม่พบหลักฐานเชื่อมโยงจากข้อมูลที่บันทึกในระบบ/);
    assert.match(dictSrc, /"di\.rel\.badgeDirect":\s*tr\("เชื่อมโยงโดยตรง"/);
    assert.doesNotMatch(dictSrc, /"di\.rel\.badgeDirect":\s*tr\("ข้อเท็จจริง"/);
  });

  test("compact why omits repeating focus person name for DIRECT_ROLE", () => {
    const copySrc = readFileSync(
      join(ROOT, "lib/drug_intelligence/drug_relationship_result_card_copy.ts"),
      "utf8"
    );
    assert.match(copySrc, /relationshipCompactWhyText/);
    assert.match(copySrc, /พบในฐานะ/);
    assert.match(copySrc, /di\.rel\.compactWhyDirect/);
  });

  test("POST relationships route is registered", () => {
    const routeSrc = readFileSync(
      join(ROOT, "app/api/drug-intelligence/search/relationships/route.ts"),
      "utf8"
    );
    assert.match(routeSrc, /export async function POST/);
    assert.match(routeSrc, /handleDrugRelationshipSearchPost/);
  });
});

describe("DI-8.3 relationship service behavior", () => {
  test("single-entity all_related groups multiple target types + hydrates case chronology", async () => {
    const db = new InMemoryDatabaseClient();
    const caseService = new DrugCaseService({ db });
    await caseService.createCase(
      baseCase({
        caseNumber: "DI-TEST-001",
        arrestDate: new Date("2026-08-01"),
        arrestTime: "21:30",
        persons: [
          person("นายกิตติศักดิ์ ทดสอบระบบ", "0900001001", {
            devices: [
              {
                brand: "Apple",
                model: "iPhone 14",
                serialNumber: null,
                imei1: "356789101234567",
                imei2: null,
                firstSeenAt: null,
                lastSeenAt: null,
                notes: null,
              },
            ],
            vehicles: [
              {
                registrationNumber: "กข1001",
                registrationProvince: "ชุมพร",
                vehicleType: null,
                brand: "Toyota",
                model: null,
                color: null,
                vin: null,
                firstSeenAt: null,
                lastSeenAt: null,
                notes: null,
              },
            ],
          }),
        ],
      })
    );
    await caseService.createCase(
      baseCase({
        caseNumber: "DI-TEST-002",
        arrestDate: new Date("2026-08-05"),
        arrestTime: null,
        persons: [person("นายกิตติศักดิ์ ทดสอบระบบ", "0900001001")],
      })
    );
    await caseService.createCase(
      baseCase({
        caseNumber: "DI-TEST-003",
        arrestDate: new Date("2026-08-10"),
        arrestTime: "09:00",
        persons: [person("นายกิตติศักดิ์ ทดสอบระบบ", "0900001001")],
      })
    );

    const persons = await db.drugPerson.findMany({});
    // Merge-aware: same name may create separate persons depending on resolver;
    // take the person linked to phones.
    const focus =
      persons.find((p: { primaryFullName: string }) => p.primaryFullName.includes("กิตติศักดิ์")) ?? persons[0];

    const service = new DrugIntelligenceRelationshipQueryService(db);
    const result = await service.query(
      {
        source: { entityType: "PERSON", entityId: focus.id },
        relationId: "person_all_related",
        target: { entityType: "CASE" },
      },
      { canViewFull: true, actorId: "mock:admin", actorName: "Administrator" }
    );

    assert.ok(result.summary.found);
    assert.ok(result.summary.total >= 1);
    assert.ok((result.summary.relatedCaseCount ?? 0) >= 1);
    const withCases = result.results.find((r) => (r.relatedCases?.length ?? 0) > 0);
    if (withCases?.relatedCases && withCases.relatedCases.length >= 2) {
      const dates = withCases.relatedCases.map((c) => c.arrestDate).filter(Boolean);
      for (let i = 1; i < dates.length; i++) {
        assert.ok(String(dates[i]) >= String(dates[i - 1]), "relatedCases must be chronological by arrestDate");
      }
      const missingTime = withCases.relatedCases.find((c) => c.caseNumber === "DI-TEST-002");
      if (missingTime) assert.equal(missingTime.arrestTime, null);
    }
  });

  test("phone all_related returns related persons/cases", async () => {
    const db = new InMemoryDatabaseClient();
    const caseService = new DrugCaseService({ db });
    await caseService.createCase(
      baseCase({
        caseNumber: "DI83-PHONE",
        persons: [person("ผู้ใช้เบอร์", "0900001001")],
      })
    );
    const phones = await db.drugPhoneNumber.findMany({});
    const phone = phones.find((p: { normalizedNumber?: string }) => String(p.normalizedNumber ?? "").includes("900001001")) ?? phones[0];
    const service = new DrugIntelligenceRelationshipQueryService(db);
    const result = await service.query(
      {
        source: { entityType: "PHONE", entityId: phone.id },
        relationId: "phone_all_related",
        target: { entityType: "CASE" },
      },
      { canViewFull: true }
    );
    assert.ok(result.summary.found);
    assert.ok(result.results.some((r) => r.to.entityType === "CASE" || r.to.entityType === "PERSON"));
  });

  test("pair path search returns shortest useful paths with pathIndex", async () => {
    const db = new InMemoryDatabaseClient();
    const caseService = new DrugCaseService({ db });
    await caseService.createCase(
      baseCase({
        caseNumber: "DI83-PATH",
        persons: [person("บุคคล เอ เส้นทาง", "0822223333"), person("บุคคล บี เส้นทาง")],
      })
    );
    const persons = await db.drugPerson.findMany({});
    const a = persons.find((p: { primaryFullName: string }) => p.primaryFullName.includes("เอ"))!;
    const b = persons.find((p: { primaryFullName: string }) => p.primaryFullName.includes("บี"))!;
    const service = new DrugIntelligenceRelationshipQueryService(db);
    const result = await service.query(
      {
        source: { entityType: "PERSON", entityId: a.id },
        relationId: "person_path_to_person",
        target: { entityType: "PERSON", entityId: b.id },
      },
      { canViewFull: true }
    );
    assert.equal(result.summary.found, true);
    assert.ok(result.results.length >= 1);
    assert.ok(result.results.length <= DRUG_REL_SEARCH_MAX_PATHS);
    assert.equal(result.bounds.depth, DRUG_REL_SEARCH_PATH_MAX_DEPTH);
    for (const [i, row] of result.results.entries()) {
      assert.equal(row.resultKind, "PATH");
      assert.ok(row.pathSteps && row.pathSteps.length >= 2);
      if (row.explanation && typeof row.explanation === "object" && "pathIndex" in row.explanation) {
        assert.equal(row.explanation.pathIndex, i + 1);
      }
    }
  });

  test("no-evidence pair returns found=false without inventing absence", async () => {
    const db = new InMemoryDatabaseClient();
    const caseService = new DrugCaseService({ db });
    await caseService.createCase(baseCase({ caseNumber: "DI83-A", persons: [person("ไม่เชื่อม เอ")] }));
    await caseService.createCase(baseCase({ caseNumber: "DI83-B", persons: [person("ไม่เชื่อม บี")] }));
    const persons = await db.drugPerson.findMany({});
    const a = persons.find((p: { primaryFullName: string }) => p.primaryFullName.includes("เอ"))!;
    const b = persons.find((p: { primaryFullName: string }) => p.primaryFullName.includes("บี"))!;
    const service = new DrugIntelligenceRelationshipQueryService(db);
    const result = await service.query(
      {
        source: { entityType: "PERSON", entityId: a.id },
        relationId: "person_path_to_person",
        target: { entityType: "PERSON", entityId: b.id },
      },
      { canViewFull: true }
    );
    assert.equal(result.summary.found, false);
    assert.deepEqual(result.results, []);
  });

  test("invalid relation / entity type rejected", async () => {
    const db = new InMemoryDatabaseClient();
    const service = new DrugIntelligenceRelationshipQueryService(db);
    await assert.rejects(
      () =>
        service.query(
          {
            source: { entityType: "PERSON", entityId: "x" },
            relationId: "not_a_real_relation",
            target: { entityType: "CASE" },
          },
          { canViewFull: true }
        ),
      DrugRelationshipQueryValidationError
    );
  });

  test("PHONE masking respects canViewFull", async () => {
    const db = new InMemoryDatabaseClient();
    const caseService = new DrugCaseService({ db });
    await caseService.createCase(baseCase({ persons: [person("หน้ากาก เบอร์", "0811112222")] }));
    const persons = await db.drugPerson.findMany({});
    const service = new DrugIntelligenceRelationshipQueryService(db);
    const masked = await service.query(
      {
        source: { entityType: "PERSON", entityId: persons[0].id },
        relationId: "person_related_phone",
        target: { entityType: "PHONE" },
      },
      { canViewFull: false }
    );
    assert.ok(masked.summary.found);
    assert.ok(masked.results.every((r) => /x/i.test(r.to.label) || r.to.label.includes("•") || r.to.label !== "0811112222"));
  });

  test("findPaths multi-path prefers shorter first and caps", async () => {
    const db = new InMemoryDatabaseClient();
    const caseService = new DrugCaseService({ db });
    await caseService.createCase(
      baseCase({
        caseNumber: "DI83-MULTI",
        persons: [person("มัลติ เอ", "0833334444"), person("มัลติ บี", "0833334444")],
      })
    );
    const persons = await db.drugPerson.findMany({});
    const [a, b] = persons;
    const graph = new DrugNetworkGraphService(db);
    const result = await graph.findPaths(
      {
        fromType: "PERSON",
        fromId: a.id,
        toType: "PERSON",
        toId: b.id,
        maxDepth: DRUG_REL_SEARCH_PATH_MAX_DEPTH,
        maxPaths: DRUG_REL_SEARCH_MAX_PATHS,
      },
      { canViewFull: true }
    );
    assert.equal(result.found, true);
    assert.ok(result.paths.length >= 1);
    assert.ok(result.paths.length <= DRUG_REL_SEARCH_MAX_PATHS);
    for (let i = 1; i < result.paths.length; i++) {
      assert.ok(result.paths[i]!.hopCount >= result.paths[i - 1]!.hopCount);
    }
  });
});
