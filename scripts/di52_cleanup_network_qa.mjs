/**
 * DI-5.2 QA fixture cleanup — removes ONLY the DI-5.2 network QA dataset
 * (Cases QA-001..QA-005, Persons A-F, and every phone/SIM/device/vehicle/
 * location/seized-item reachable only through those cases), never a
 * blanket Drug Intelligence table wipe.
 *
 * Deliberately explicit and scoped: every delete is keyed off the QA-00X
 * case numbers or the QA-tagged entity values (QA-SIM-*, QA-100X/QA-500X
 * registrations, 9900000000000X IMEIs, 080-000-000X phones normalized to
 * 6680000000X) — never a delete-everything-in-table statement.
 *
 * NOT executed automatically. Run manually when the user is done with
 * browser inspection:
 *   npx tsx scripts/di52_cleanup_network_qa.mjs
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createDatabaseClient } from "../lib/database/database.js";

const db = createDatabaseClient();

const QA_CASE_NUMBERS = ["QA-001", "QA-002", "QA-003", "QA-004", "QA-005"];

const cases = await db.drugCase.findMany({});
const qaCases = cases.filter((c) => QA_CASE_NUMBERS.includes(c.caseNumber));
const qaCaseIds = qaCases.map((c) => c.id);
console.log(
  "QA cases to remove:",
  qaCases.map((c) => c.caseNumber)
);

if (qaCaseIds.length === 0) {
  console.log("No DI-5.2 QA cases found — nothing to clean up.");
  process.exit(0);
}

// Persons touched by these cases (via DrugCasePerson) — includes A-E. Person F
// is never linked to a case, so it's found separately via its QA fixture note.
const casePersonLinks = (await db.drugCasePerson.findMany({})).filter((l) => qaCaseIds.includes(l.caseId));
const qaPersonIdsFromCases = [...new Set(casePersonLinks.map((l) => l.personId))];

const allPersons = await db.drugPerson.findMany({});
const personF = allPersons.find((p) => p.notes && p.notes.includes("DI-5.2 QA fixture") && p.notes.includes("duplicate-match"));
const qaPersonIds = [...new Set([...qaPersonIdsFromCases, ...(personF ? [personF.id] : [])])];
console.log("QA persons to remove:", qaPersonIds.length);

// Entities reachable from these cases — resolve ids first so we can safely
// delete the case-scoped link rows, THEN the durable Person<->entity rows,
// THEN the canonical entities themselves (only if not referenced elsewhere,
// which in a clean QA-only fixture is always true — this dataset never
// shares an entity with real data since row counts were 0 before seeding).
const casePhones = (await db.drugCasePhone.findMany({})).filter((l) => qaCaseIds.includes(l.caseId));
const caseSims = (await db.drugCaseSim.findMany({})).filter((l) => qaCaseIds.includes(l.caseId));
const caseDevices = (await db.drugCaseDevice.findMany({})).filter((l) => qaCaseIds.includes(l.caseId));
const caseVehicles = (await db.drugCaseVehicle.findMany({})).filter((l) => qaCaseIds.includes(l.caseId));
const caseLocations = (await db.drugCaseLocation.findMany({})).filter((l) => qaCaseIds.includes(l.caseId));

const phoneIds = [...new Set(casePhones.map((l) => l.phoneNumberId))];
const simIds = [...new Set(caseSims.map((l) => l.simId))];
const deviceIds = [...new Set(caseDevices.map((l) => l.deviceId))];
const vehicleIds = [...new Set(caseVehicles.map((l) => l.vehicleId))];
const locationIds = [...new Set(caseLocations.map((l) => l.locationId))];

console.log("Entities to remove:", { phoneIds: phoneIds.length, simIds: simIds.length, deviceIds: deviceIds.length, vehicleIds: vehicleIds.length, locationIds: locationIds.length });

// Delete order respects FK dependency: seized items and link/junction rows
// first, then durable Person<->entity rows, then canonical entities, then
// case-person links, then the cases themselves, then the standalone F
// person's identifier/alias rows via cascade (DrugPerson delete cascades
// to DrugPersonIdentifier/DrugPersonAlias per schema onDelete: Cascade).
await db.drugSeizedItem.deleteMany({ where: { caseId: { in: qaCaseIds } } });
await db.drugCaseLocation.deleteMany({ where: { caseId: { in: qaCaseIds } } });
await db.drugCasePhone.deleteMany({ where: { caseId: { in: qaCaseIds } } });
await db.drugCaseSim.deleteMany({ where: { caseId: { in: qaCaseIds } } });
await db.drugCaseDevice.deleteMany({ where: { caseId: { in: qaCaseIds } } });
await db.drugCaseVehicle.deleteMany({ where: { caseId: { in: qaCaseIds } } });
await db.drugPersonDevice.deleteMany({ where: { deviceId: { in: deviceIds } } });
await db.drugPersonVehicle.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
await db.drugCasePerson.deleteMany({ where: { caseId: { in: qaCaseIds } } });

for (const id of locationIds) await db.drugLocation.deleteMany({ where: { id } });
for (const id of phoneIds) await db.drugPhoneNumber.deleteMany({ where: { id } });
for (const id of simIds) await db.drugSim.deleteMany({ where: { id } });
for (const id of deviceIds) await db.drugDevice.deleteMany({ where: { id } });
for (const id of vehicleIds) await db.drugVehicle.deleteMany({ where: { id } });

for (const caseId of qaCaseIds) await db.drugCase.deleteMany({ where: { id: caseId } });
for (const personId of qaPersonIds) await db.drugPerson.deleteMany({ where: { id: personId } });

console.log("\nDI-5.2 QA fixture removed.");
const remaining = { DrugCase: await db.drugCase.count(), DrugPerson: await db.drugPerson.count() };
console.log("Remaining Drug Intelligence rows after cleanup:", JSON.stringify(remaining));
