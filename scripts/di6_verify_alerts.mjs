/**
 * DI-6 QA verification — generates alerts for the DI-5.2 QA cases (already
 * seeded, still present) and reports counts/reasons against the known
 * relationships (A+B shared phone, B+C shared device, A+D shared vehicle,
 * A in QA-001+QA-003, C in QA-002+QA-004, E isolated, A/F duplicate
 * candidate). Read-mostly: only writes DrugIntelligenceAlert rows (via the
 * real alert-generation service, upserted/deduplicated by dedupeKey) —
 * never touches DrugCase/DrugPerson/etc. QA fixture data.
 *
 * Not idempotent-destructive: re-running is safe (upsertByDedupeKey never
 * duplicates), but appends to DrugIntelligenceAlert. Not part of automated
 * test suite; run manually.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createDatabaseClient } from "../lib/database/database.js";
import { DrugIntelligenceAlertService } from "../lib/drug_intelligence/drug_intelligence_alert_service.js";

const db = createDatabaseClient();
const alertService = new DrugIntelligenceAlertService(db);

const QA_CASE_NUMBERS = ["QA-001", "QA-002", "QA-003", "QA-004", "QA-005"];
const cases = await db.drugCase.findMany({});
const qaCases = cases.filter((c) => QA_CASE_NUMBERS.includes(c.caseNumber));
console.log("QA cases found:", qaCases.map((c) => c.caseNumber));

console.log("\n=== Generating/refreshing alerts for each QA case ===");
const allGenerated = [];
for (const c of qaCases.sort((a, b) => a.caseNumber.localeCompare(b.caseNumber))) {
  const generated = await alertService.generateAlertsForCase(c.id, "mock:admin", "Administrator");
  console.log(`\n--- ${c.caseNumber} (${c.id}) ---`);
  for (const alert of generated) {
    console.log(`  [${alert.severity}] ${alert.alertType} entityType=${alert.entityType} entityId=${alert.entityId} priorCases=${JSON.stringify(alert.priorCaseIds)} relatedPersons=${JSON.stringify(alert.relatedPersonIds)} occurrenceCount=${alert.occurrenceCount}`);
  }
  allGenerated.push(...generated);
}

console.log("\n=== Resolve entity ids for readability ===");
const persons = await db.drugPerson.findMany({});
const personById = new Map(persons.map((p) => [p.id, p]));
const phones = await db.drugPhoneNumber.findMany({});
const phoneById = new Map(phones.map((p) => [p.id, p]));
const devices = await db.drugDevice.findMany({});
const deviceById = new Map(devices.map((d) => [d.id, d]));
const vehicles = await db.drugVehicle.findMany({});
const vehicleById = new Map(vehicles.map((v) => [v.id, v]));

function labelFor(entityType, entityId) {
  if (entityType === "PERSON") return personById.get(entityId)?.primaryFullName ?? entityId;
  if (entityType === "PHONE") return phoneById.get(entityId)?.normalizedNumber ?? entityId;
  if (entityType === "DEVICE") return deviceById.get(entityId)?.imei1 ?? entityId;
  if (entityType === "VEHICLE") return vehicleById.get(entityId)?.registrationNumber ?? entityId;
  return entityId;
}

console.log("\n=== All alerts, human-readable ===");
const allAlerts = await alertService.listAlerts({});
for (const alert of allAlerts.alerts) {
  console.log(`[${alert.severity}] ${alert.alertType} — ${labelFor(alert.entityType, alert.entityId)} — status=${alert.status} — prior cases: ${alert.priorCaseIds.length}`);
}

console.log("\n=== KPI ===");
console.log(JSON.stringify(allAlerts.kpi, null, 2));

console.log("\n=== Person E negative control: must have ZERO alerts ===");
const personE = persons.find((p) => p.primaryFullName === "นาย ทดสอบ ห้า");
if (personE) {
  const eAlerts = await alertService.getAlertsForEntity("PERSON", personE.id);
  console.log(`Person E (${personE.id}) alert count: ${eAlerts.length} (expect 0)`);
} else {
  console.log("Person E not found by name — dataset may differ from DI-5.2 baseline.");
}

console.log("\n=== A/F duplicate candidate: must be HIGH_CONFIDENCE_DUPLICATE, never auto-merged ===");
const dupeAlerts = allAlerts.alerts.filter((a) => a.alertType === "HIGH_CONFIDENCE_DUPLICATE");
console.log(`HIGH_CONFIDENCE_DUPLICATE alerts: ${dupeAlerts.length}`);
for (const d of dupeAlerts) {
  console.log(`  entityId=${d.entityId} (${labelFor("PERSON", d.entityId)}) relatedPersonIds=${JSON.stringify(d.relatedPersonIds)}`);
}
const mergeRows = await db.drugPersonMerge.findMany({});
console.log(`DrugPersonMerge rows (must be 0 — DI-6 never auto-merges): ${mergeRows.length}`);

console.log("\n=== DONE ===");
