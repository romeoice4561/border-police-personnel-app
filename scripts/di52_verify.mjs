import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createDatabaseClient } from "../lib/database/database.js";
import { DrugNetworkGraphService } from "../lib/drug_intelligence/drug_network_graph_service.js";
import { DrugIntelligenceSearchService } from "../lib/drug_intelligence/drug_intelligence_search_service.js";
import { DrugEntityDetailService } from "../lib/drug_intelligence/drug_entity_detail_service.js";

const db = createDatabaseClient();

console.log("=== Section 9: Database row counts ===");
const counts = {
  DrugCase: await db.drugCase.count(),
  DrugPerson: await db.drugPerson.count(),
  DrugPhoneNumber: await db.drugPhoneNumber.count(),
  DrugSim: await db.drugSim.count(),
  DrugDevice: await db.drugDevice.count(),
  DrugVehicle: await db.drugVehicle.count(),
  DrugLocation: await db.drugLocation.count(),
  DrugSeizedItem: await db.drugSeizedItem.count(),
  DrugCasePerson: await db.drugCasePerson.count(),
  DrugCasePhone: await db.drugCasePhone.count(),
  DrugCaseDevice: await db.drugCaseDevice.count(),
  DrugCaseVehicle: await db.drugCaseVehicle.count(),
};
console.log(JSON.stringify(counts, null, 2));

// Resolve entity ids by their QA-tagged values (not hardcoded from the seed run,
// so this script is independently re-runnable against whatever is currently seeded).
const personA = await db.drugPerson.findMany({ where: { primaryFullName: "นาย ทดสอบ หนึ่ง" } });
const realA = personA.find((p) => p.notes && p.notes.includes("แดง") && !p.notes.includes("duplicate-match"));
const personB = (await db.drugPerson.findMany({ where: { primaryFullName: "นาย ทดสอบ สอง" } }))[0];
const personC = (await db.drugPerson.findMany({ where: { primaryFullName: "นาย ทดสอบ สาม" } }))[0];
const personD = (await db.drugPerson.findMany({ where: { primaryFullName: "นาย ทดสอบ สี่" } }))[0];
const personE = (await db.drugPerson.findMany({ where: { primaryFullName: "นาย ทดสอบ ห้า" } }))[0];
const personF = personA.find((p) => p.notes && p.notes.includes("duplicate-match"));

const A = realA.id, B = personB.id, C = personC.id, D = personD.id, E = personE.id, F = personF.id;
console.log("\nResolved ids:", { A, B, C, D, E, F });

const phone1 = await db.drugPhoneNumber.findUnique({ where: { normalizedNumber: "66800000001" } });
const imei2Device = (await db.drugDevice.findMany({ where: { imei1: "990000000000002" } }))[0];
const vehicleQA1001 = (await db.drugVehicle.findMany({ where: { registrationNumber: "QA-1001" } }))[0];
console.log("Phone 080-000-0001 id:", phone1?.id);
console.log("Device IMEI 990000000000002 id:", imei2Device?.id);
console.log("Vehicle QA-1001 id:", vehicleQA1001?.id);

console.log("\n=== Section 14: Shared-entity verification ===");
const phone1Links = await db.drugCasePhone.findMany({ where: { phoneNumberId: phone1?.id } });
console.log("Phone 080-000-0001 linked to persons:", [...new Set(phone1Links.map((l) => l.personId))]);
const imei2Links = await db.drugPersonDevice.findMany({ where: { deviceId: imei2Device?.id } });
console.log("IMEI ...0002 device linked to persons (durable):", imei2Links.map((l) => l.personId));
const vehicleLinks = await db.drugPersonVehicle.findMany({ where: { vehicleId: vehicleQA1001?.id } });
console.log("Vehicle QA-1001 linked to persons (durable):", vehicleLinks.map((l) => l.personId));

console.log("\n=== Section 10: Automated network verification ===");
const graph = new DrugNetworkGraphService(db);

async function neighborhoodReport(label, entityId) {
  const result = await graph.getNeighborhood({ entityType: "PERSON", entityId, depth: 1 }, { canViewFull: true });
  const nodeIds = result.nodes.map((n) => ({ type: n.type, id: n.id, label: n.label }));
  const edges = result.edges.map((e) => ({ rel: e.relationshipType, kind: e.edgeKind, source: e.source, target: e.target }));
  console.log(`\n--- Neighborhood ${label} (1-hop) ---`);
  console.log("Nodes:", JSON.stringify(nodeIds, null, 2));
  console.log("Edges:", JSON.stringify(edges, null, 2));
  return result;
}

const neighborhoodA = await neighborhoodReport("A", A);
const neighborhoodB = await neighborhoodReport("B", B);
const neighborhoodC = await neighborhoodReport("C", C);

console.log("\n--- Path A -> C ---");
const pathAC = await graph.findPaths({ fromType: "PERSON", fromId: A, toType: "PERSON", toId: C, maxDepth: 4 }, { canViewFull: true });
console.log("found:", pathAC.found);
if (pathAC.found) console.log("steps:", pathAC.paths[0].steps.map((s) => ({ type: s.node.type, label: s.node.label, viaRel: s.viaEdge?.relationshipType ?? null })));

console.log("\n--- Path D -> C ---");
const pathDC = await graph.findPaths({ fromType: "PERSON", fromId: D, toType: "PERSON", toId: C, maxDepth: 4 }, { canViewFull: true });
console.log("found:", pathDC.found);
if (pathDC.found) console.log("steps:", pathDC.paths[0].steps.map((s) => ({ type: s.node.type, label: s.node.label, viaRel: s.viaEdge?.relationshipType ?? null })));

console.log("\n--- Path A -> E (must be NO PATH) ---");
const pathAE = await graph.findPaths({ fromType: "PERSON", fromId: A, toType: "PERSON", toId: E, maxDepth: 4 }, { canViewFull: true });
console.log("found (expect false):", pathAE.found);

console.log("\n=== Section 11: Search verification ===");
const search = new DrugIntelligenceSearchService(db);
for (const q of ["นาย ทดสอบ หนึ่ง", "แดง", "0800000001", "990000000000002", "QA-1001", "QA-001"]) {
  const r = await search.searchGrouped({ query: q }, { canViewFull: true });
  const summary = r.groups.map((g) => ({ type: g.entityType, count: g.count, first: g.results[0]?.primaryLabel }));
  console.log(`Query "${q}" -> totalCount=${r.totalCount}`, JSON.stringify(summary));
}

console.log("\n=== Section 12: Entity detail verification ===");
const entityDetail = new DrugEntityDetailService(db);
const phoneDetail = await entityDetail.getPhoneDetail(phone1.id);
console.log("Phone 080-000-0001 -> relatedPersons:", phoneDetail.relatedPersons.map((p) => p.primaryFullName), "sourceCases:", phoneDetail.sourceCases.map((c) => c.caseNumber));
const deviceDetail = await entityDetail.getDeviceDetail(imei2Device.id);
console.log("IMEI ...0002 -> relatedPersons:", deviceDetail.relatedPersons.map((p) => p.primaryFullName), "sourceCases:", deviceDetail.sourceCases.map((c) => c.caseNumber));
const vehicleDetail = await entityDetail.getVehicleDetail(vehicleQA1001.id);
console.log("Vehicle QA-1001 -> relatedPersons:", vehicleDetail.relatedPersons.map((p) => p.primaryFullName), "sourceCases:", vehicleDetail.sourceCases.map((c) => c.caseNumber));

console.log("\n=== Section 13: Seizure analytics verification ===");
const seizedItems = await db.drugSeizedItem.findMany({});
const qaSeized = seizedItems.filter((s) => s.notes === "DI-5.2 QA fixture");
const totals = {};
for (const item of qaSeized) {
  const key = item.drugCategory;
  const amount = item.measurementKind === "COUNT" ? Number(item.quantity) : Number(item.weightGrams);
  totals[key] = totals[key] ?? { measurementKind: item.measurementKind, total: 0 };
  totals[key].total += amount;
}
console.log(JSON.stringify(totals, null, 2));

console.log("\n=== DONE ===");
