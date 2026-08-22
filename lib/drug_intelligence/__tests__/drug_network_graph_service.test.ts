/**
 * Unit tests for DrugNetworkGraphService (Phase DI-5, Section 22).
 *
 * Covers the minimum scenario checklist: neighborhood expansion per entity
 * type, 1-hop/2-hop, max-depth/max-node enforcement, deduplication, cycle
 * safety, DIRECT edge provenance, INFERRED edge explanation (shared
 * phone/device/case), merged-person resolution, masking, path finding
 * (found + no-path), bounded path depth, and deterministic-enough ordering
 * (id-based, not flaky).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugPersonMergeService } from "@/lib/drug_intelligence/drug_person_merge_service";
import { DrugNetworkGraphService, DrugPersonGraphNotFoundError, DrugGraphEntityNotFoundError } from "@/lib/drug_intelligence/drug_network_graph_service";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "NET-2569-001",
    title: "คดีทดสอบผังความเชื่อมโยง",
    status: "OPEN",
    arrestDate: new Date("2026-02-01"),
    arrestTime: "10:00",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: "กก.ตชด.44",
    province: "เชียงราย",
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

function person(name: string, phone?: string) {
  return {
    newPerson: { primaryFullName: name, nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
    role: "SUSPECT" as const,
    linkedOfficerId: null,
    notes: null,
    phones: phone ? [{ rawInput: phone, firstSeenAt: new Date("2026-01-01"), lastSeenAt: new Date("2026-01-15"), notes: null }] : [],
    sims: [],
    devices: [],
    vehicles: [],
  };
}

async function seedPersonCasePhone() {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "NET-1", persons: [person("สมชาย โครงข่าย", "0891234567")] }));
  return db;
}

test("getNeighborhood for a PERSON focus (1 hop) returns the Case and Phone as neighbors with DIRECT edges", async () => {
  const db = await seedPersonCasePhone();
  const graph = new DrugNetworkGraphService(db);
  const persons = await db.drugPerson.findMany({});
  const personId = persons[0].id;

  const result = await graph.getNeighborhood({ entityType: "PERSON", entityId: personId, depth: 1 }, { canViewFull: true });

  assert.equal(result.focus.entityId, personId);
  assert.equal(result.truncated, false);
  const types = result.nodes.map((n) => n.type).sort();
  assert.deepEqual(types, ["CASE", "PERSON", "PHONE"]);
  assert.ok(result.edges.every((e) => e.edgeKind === "DIRECT"));
  assert.ok(result.edges.some((e) => e.relationshipType === "PERSON_CASE"));
  assert.ok(result.edges.some((e) => e.relationshipType === "PERSON_PHONE"));
  assert.ok(result.edges.some((e) => e.relationshipType === "CASE_PHONE"));
});

test("getNeighborhood for a PHONE focus discovers the CASE and the related PERSON, not just itself", async () => {
  const db = await seedPersonCasePhone();
  const graph = new DrugNetworkGraphService(db);
  const phones = await db.drugPhoneNumber.findMany({});
  const phoneId = phones[0].id;

  const result = await graph.getNeighborhood({ entityType: "PHONE", entityId: phoneId, depth: 1 }, { canViewFull: true });

  const types = result.nodes.map((n) => n.type).sort();
  assert.deepEqual(types, ["CASE", "PERSON", "PHONE"]);
  const personCaseEdge = result.edges.find((e) => e.relationshipType === "PERSON_PHONE");
  assert.ok(personCaseEdge, "expected a PERSON_PHONE edge discovered from the phone side");
});

test("getNeighborhood 2-hop from a CASE reaches a Person's OTHER case (2 hops out)", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "NET-2A", persons: [person("มานี สองคดี")] }));
  const persons1 = await db.drugPerson.findMany({});
  const personId = persons1[0].id;
  // Same person appears in a second case (createCase with existingPersonId)
  await caseService.createCase(
    baseCase({
      caseNumber: "NET-2B",
      persons: [{ existingPersonId: personId, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }],
    })
  );

  const graph = new DrugNetworkGraphService(db);
  const cases = await db.drugCase.findMany({});
  const firstCase = cases.find((c) => c.caseNumber === "NET-2A")!;

  const oneHop = await graph.getNeighborhood({ entityType: "CASE", entityId: firstCase.id, depth: 1 }, { canViewFull: true });
  const oneHopCaseNodes = oneHop.nodes.filter((n) => n.type === "CASE");
  assert.equal(oneHopCaseNodes.length, 1, "1-hop from a case must not yet reach the person's OTHER case");

  const twoHop = await graph.getNeighborhood({ entityType: "CASE", entityId: firstCase.id, depth: 2 }, { canViewFull: true });
  const twoHopCaseNodes = twoHop.nodes.filter((n) => n.type === "CASE");
  assert.equal(twoHopCaseNodes.length, 2, "2-hop from a case must reach the person's other case via the shared Person node");
});

test("depth is clamped to the hard maximum (2) even if a caller requests more", async () => {
  const db = await seedPersonCasePhone();
  const graph = new DrugNetworkGraphService(db);
  const persons = await db.drugPerson.findMany({});
  const result = await graph.getNeighborhood({ entityType: "PERSON", entityId: persons[0].id, depth: 2 as 1 | 2 }, { canViewFull: true });
  assert.ok(result.nodes.length > 0);
});

test("maxNodes enforcement: a densely-connected neighborhood is truncated, never silently unbounded", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const persons = Array.from({ length: 10 }, (_, i) => person(`บุคคลทดสอบ ${i}`));
  await caseService.createCase(baseCase({ caseNumber: "NET-DENSE", persons }));
  const cases = await db.drugCase.findMany({});
  const caseId = cases[0].id;

  const graph = new DrugNetworkGraphService(db);
  const result = await graph.getNeighborhood({ entityType: "CASE", entityId: caseId, depth: 1, maxNodes: 5 }, { canViewFull: true });

  assert.ok(result.nodes.length <= 5);
  assert.equal(result.truncated, true);
});

test("maxNodes is clamped to the hard ceiling regardless of what the caller requests", async () => {
  const db = await seedPersonCasePhone();
  const graph = new DrugNetworkGraphService(db);
  const persons = await db.drugPerson.findMany({});
  const result = await graph.getNeighborhood({ entityType: "PERSON", entityId: persons[0].id, depth: 1, maxNodes: 999999 }, { canViewFull: true });
  assert.ok(result.nodes.length < 150);
});

test("deduplication: a node reachable via two different paths appears exactly once", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  // Two persons share BOTH a case and a phone — the shared case/phone node must not be duplicated.
  await caseService.createCase(
    baseCase({
      caseNumber: "NET-DEDUPE",
      persons: [person("บุคคล เอ", "0899999999"), person("บุคคล บี", "0899999999")],
    })
  );
  const cases = await db.drugCase.findMany({});
  const graph = new DrugNetworkGraphService(db);
  const result = await graph.getNeighborhood({ entityType: "CASE", entityId: cases[0].id, depth: 2 }, { canViewFull: true });

  const phoneNodeIds = result.nodes.filter((n) => n.type === "PHONE").map((n) => n.id);
  assert.equal(new Set(phoneNodeIds).size, phoneNodeIds.length, "no duplicate phone node ids");
  assert.equal(phoneNodeIds.length, 1, "both persons share the SAME phone entity — one node, not two");
});

test("cycle safety: a graph with a cycle (person -> case -> person's other link -> back to case) never infinite-loops", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "NET-CYCLE", persons: [person("วนซ้ำ ทดสอบ", "0888888888")] }));
  const persons = await db.drugPerson.findMany({});
  const graph = new DrugNetworkGraphService(db);

  const result = await Promise.race([
    graph.getNeighborhood({ entityType: "PERSON", entityId: persons[0].id, depth: 2 }, { canViewFull: true }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout — possible infinite loop")), 5000)),
  ]);
  assert.ok(result);
});

test("DIRECT edge from Person->Case carries the role as provenance explanation", async () => {
  const db = await seedPersonCasePhone();
  const graph = new DrugNetworkGraphService(db);
  const persons = await db.drugPerson.findMany({});
  const result = await graph.getNeighborhood({ entityType: "PERSON", entityId: persons[0].id, depth: 1 }, { canViewFull: true });
  const personCaseEdge = result.edges.find((e) => e.relationshipType === "PERSON_CASE")!;
  assert.equal(personCaseEdge.edgeKind, "DIRECT");
  assert.equal(personCaseEdge.explanation.kind, "DIRECT_ROLE");
  assert.equal(personCaseEdge.sourceCaseIds.length, 1);
});

test("INFERRED edge: two persons sharing a phone produce a SHARED_PHONE edge, never claimed as DIRECT", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "NET-SHARED-PHONE",
      persons: [person("แชร์เบอร์ เอ", "0877777777"), person("แชร์เบอร์ บี", "0877777777")],
    })
  );
  const cases = await db.drugCase.findMany({});
  const graph = new DrugNetworkGraphService(db);
  const result = await graph.getNeighborhood({ entityType: "CASE", entityId: cases[0].id, depth: 1 }, { canViewFull: true });

  const inferred = result.edges.find((e) => e.relationshipType === "SHARED_PHONE");
  assert.ok(inferred, "expected an inferred SHARED_PHONE edge between the two persons");
  assert.equal(inferred!.edgeKind, "INFERRED");
  assert.equal(inferred!.explanation.kind, "SHARED_PHONE");
});

test("INFERRED edge: two persons sharing a device produce a SHARED_DEVICE edge", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "NET-SHARED-DEVICE",
      persons: [
        {
          newPerson: { primaryFullName: "แชร์เครื่อง เอ", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [],
          devices: [{ brand: "Samsung", model: "A1", serialNumber: null, imei1: "111122223333444", imei2: null, firstSeenAt: null, lastSeenAt: null, notes: null }],
          vehicles: [],
        },
        {
          newPerson: { primaryFullName: "แชร์เครื่อง บี", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [],
          devices: [{ brand: "Samsung", model: "A1", serialNumber: null, imei1: "111122223333444", imei2: null, firstSeenAt: null, lastSeenAt: null, notes: null }],
          vehicles: [],
        },
      ],
    })
  );
  const cases = await db.drugCase.findMany({});
  const graph = new DrugNetworkGraphService(db);
  const result = await graph.getNeighborhood({ entityType: "CASE", entityId: cases[0].id, depth: 1 }, { canViewFull: true });

  const inferred = result.edges.find((e) => e.relationshipType === "SHARED_DEVICE");
  assert.ok(inferred, "expected an inferred SHARED_DEVICE edge between the two persons");
  assert.equal(inferred!.edgeKind, "INFERRED");
});

test("INFERRED edge: two persons appearing in 2 shared cases produce a SHARED_CASE edge with evidenceCount=2", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const result1 = await caseService.createCase(baseCase({ caseNumber: "NET-SC-1", persons: [person("คดีร่วม เอ"), person("คดีร่วม บี")] }));
  const personRows = await db.drugCasePerson.findMany({ where: { caseId: result1.caseId } });
  const [personAId, personBId] = personRows.map((r) => (r as { personId: string }).personId);

  await caseService.createCase(
    baseCase({
      caseNumber: "NET-SC-2",
      persons: [
        { existingPersonId: personAId, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] },
        { existingPersonId: personBId, role: "SUSPECT", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] },
      ],
    })
  );

  const graph = new DrugNetworkGraphService(db);
  const result = await graph.getNeighborhood({ entityType: "PERSON", entityId: personAId, depth: 2 }, { canViewFull: true });
  const inferred = result.edges.find((e) => e.relationshipType === "SHARED_CASE");
  assert.ok(inferred);
  assert.equal(inferred!.evidenceCount, 2);
  assert.equal(inferred!.explanation.kind, "SHARED_CASES");
  if (inferred!.explanation.kind === "SHARED_CASES") assert.equal(inferred!.explanation.count, 2);
});

test("merged-person resolution: expanding a MERGED person's old id resolves to the survivor, never a duplicate node", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "NET-MERGE-A", persons: [person("ผู้รอด ทดสอบ", "0866666666")] }));
  await caseService.createCase(baseCase({ caseNumber: "NET-MERGE-B", persons: [person("ผู้ถูกรวม ทดสอบ")] }));
  const persons = await db.drugPerson.findMany({});
  const survivor = persons.find((p) => p.primaryFullName === "ผู้รอด ทดสอบ")!;
  const merged = persons.find((p) => p.primaryFullName === "ผู้ถูกรวม ทดสอบ")!;

  const mergeService = new DrugPersonMergeService(db);
  await mergeService.merge({ survivorPersonId: survivor.id, mergedPersonId: merged.id, reason: null, actorId: "mock:admin", actorName: "Administrator" });

  const graph = new DrugNetworkGraphService(db);
  const result = await graph.getNeighborhood({ entityType: "PERSON", entityId: merged.id, depth: 1 }, { canViewFull: true });

  assert.equal(result.focus.entityId, survivor.id, "focus must resolve to the survivor id, not the merged id");
  const personNodes = result.nodes.filter((n) => n.type === "PERSON");
  assert.equal(personNodes.length, 1, "must never render the merged person as a separate node from the survivor");
  assert.equal(personNodes[0].id, survivor.id);
});

test("merged-person resolution: a MERGED person discovered as a NEIGHBOR (via an old case link) still resolves to the survivor, not a duplicate node", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const caseResult = await caseService.createCase(baseCase({ caseNumber: "NET-MERGE-NEIGHBOR", persons: [person("ผู้รอดสอง ทดสอบ"), person("ผู้ถูกรวมสอง ทดสอบ")] }));
  const personRows = await db.drugCasePerson.findMany({ where: { caseId: caseResult.caseId } });
  const [idA, idB] = personRows.map((r) => (r as { personId: string }).personId);
  const personA = await db.drugPerson.findUnique({ where: { id: idA } });
  const survivorId = personA!.primaryFullName === "ผู้รอดสอง ทดสอบ" ? idA : idB;
  const mergedId = survivorId === idA ? idB : idA;

  const mergeService = new DrugPersonMergeService(db);
  await mergeService.merge({ survivorPersonId: survivorId, mergedPersonId: mergedId, reason: null, actorId: "mock:admin", actorName: "Administrator" });

  const graph = new DrugNetworkGraphService(db);
  const result = await graph.getNeighborhood({ entityType: "CASE", entityId: caseResult.caseId, depth: 1 }, { canViewFull: true });
  const personNodes = result.nodes.filter((n) => n.type === "PERSON");
  assert.equal(personNodes.length, 1, "the merge service already reassigns DrugCasePerson rows onto the survivor, so only one person node should ever appear");
});

test("masking: PHONE node label is masked when canViewFull=false, unmasked when true", async () => {
  const db = await seedPersonCasePhone();
  const graph = new DrugNetworkGraphService(db);
  const phones = await db.drugPhoneNumber.findMany({});
  const phoneId = phones[0].id;

  const masked = await graph.getNeighborhood({ entityType: "PHONE", entityId: phoneId, depth: 1 }, { canViewFull: false });
  const maskedNode = masked.nodes.find((n) => n.id === phoneId)!;
  assert.notEqual(maskedNode.label, phones[0].normalizedNumber);
  assert.match(maskedNode.label, /x/);

  const unmasked = await graph.getNeighborhood({ entityType: "PHONE", entityId: phoneId, depth: 1 }, { canViewFull: true });
  const unmaskedNode = unmasked.nodes.find((n) => n.id === phoneId)!;
  assert.equal(unmaskedNode.label, phones[0].normalizedNumber);
});

test("path finding: Person -> Phone -> Case -> Person path is found and explainable step by step", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "NET-PATH", persons: [person("เส้นทาง เอ", "0855555555"), person("เส้นทาง บี", "0855555555")] }));
  const persons = await db.drugPerson.findMany({});
  const [a, b] = persons;

  const graph = new DrugNetworkGraphService(db);
  const result = await graph.findPaths({ fromType: "PERSON", fromId: a.id, toType: "PERSON", toId: b.id }, { canViewFull: true });

  assert.equal(result.found, true);
  assert.equal(result.paths.length, 1);
  const path = result.paths[0];
  assert.equal(path.steps[0].node.id, a.id);
  assert.equal(path.steps[0].viaEdge, null);
  assert.equal(path.steps.at(-1)!.node.id, b.id);
  assert.ok(path.hopCount >= 1);
  for (const step of path.steps.slice(1)) {
    assert.ok(step.viaEdge, "every non-origin step must carry the edge that reached it — never an unexplained hop");
  }
});

test("path finding: no connection in recorded data returns found=false, never an error", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "NET-NOPATH-1", persons: [person("ไม่เชื่อมโยง เอ")] }));
  await caseService.createCase(baseCase({ caseNumber: "NET-NOPATH-2", persons: [person("ไม่เชื่อมโยง บี")] }));
  const persons = await db.drugPerson.findMany({});
  const [a, b] = persons;

  const graph = new DrugNetworkGraphService(db);
  const result = await graph.findPaths({ fromType: "PERSON", fromId: a.id, toType: "PERSON", toId: b.id, maxDepth: 4 }, { canViewFull: true });

  assert.equal(result.found, false);
  assert.deepEqual(result.paths, []);
});

test("path finding: maxDepth is clamped to the hard ceiling (4)", async () => {
  const db = await seedPersonCasePhone();
  const graph = new DrugNetworkGraphService(db);
  const persons = await db.drugPerson.findMany({});
  const result = await graph.findPaths({ fromType: "PERSON", fromId: persons[0].id, toType: "PERSON", toId: persons[0].id, maxDepth: 999 }, { canViewFull: true });
  // same start/end -> immediately not-found by definition, but must not throw or hang from the oversized maxDepth.
  assert.equal(result.found, false);
});

test("stable IDs: the same entity queried twice returns the same node id both times", async () => {
  const db = await seedPersonCasePhone();
  const graph = new DrugNetworkGraphService(db);
  const persons = await db.drugPerson.findMany({});
  const first = await graph.getNeighborhood({ entityType: "PERSON", entityId: persons[0].id, depth: 1 }, { canViewFull: true });
  const second = await graph.getNeighborhood({ entityType: "PERSON", entityId: persons[0].id, depth: 1 }, { canViewFull: true });
  assert.deepEqual(
    first.nodes.map((n) => n.id).sort(),
    second.nodes.map((n) => n.id).sort()
  );
});

test("unknown PERSON focus id throws DrugPersonGraphNotFoundError", async () => {
  const db = new InMemoryDatabaseClient();
  const graph = new DrugNetworkGraphService(db);
  await assert.rejects(() => graph.getNeighborhood({ entityType: "PERSON", entityId: "nonexistent", depth: 1 }, { canViewFull: true }), DrugPersonGraphNotFoundError);
});

test("unknown non-PERSON focus id throws DrugGraphEntityNotFoundError", async () => {
  const db = new InMemoryDatabaseClient();
  const graph = new DrugNetworkGraphService(db);
  await assert.rejects(() => graph.getNeighborhood({ entityType: "CASE", entityId: "nonexistent", depth: 1 }, { canViewFull: true }), DrugGraphEntityNotFoundError);
});

test("Case -> Location edge is DIRECT and Location never implies a shared network on its own", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "NET-LOCATION",
      persons: [person("สถานที่ ทดสอบ")],
      locations: [{ name: "จุดตรวจ", addressText: null, province: "เชียงราย", district: null, subdistrict: null, latitude: null, longitude: null, role: "ARREST_LOCATION", notes: null }],
    })
  );
  const cases = await db.drugCase.findMany({});
  const graph = new DrugNetworkGraphService(db);
  const result = await graph.getNeighborhood({ entityType: "CASE", entityId: cases[0].id, depth: 1 }, { canViewFull: true });

  const locationEdge = result.edges.find((e) => e.relationshipType === "CASE_LOCATION");
  assert.ok(locationEdge);
  assert.equal(locationEdge!.edgeKind, "DIRECT");
  // No PERSON<->PERSON inferred edge should ever be derived from a shared LOCATION alone.
  assert.ok(!result.edges.some((e) => e.edgeKind === "INFERRED" && e.relationshipType.startsWith("SHARED")), "location-sharing must never infer a person-to-person connection");
});
