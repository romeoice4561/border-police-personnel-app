/**
 * DI-7.4 QA Enrichment Script — Advanced Person Search fixture.
 *
 * TEST / QA ONLY. Never run against production data.
 *
 * Enriches the existing DI-5.2 QA persons A–F with the DI-7.2/7.3 fields
 * (nickname, sex, nationality, approximateAge, aliases, network roles, network
 * memberships) so the DI-7.4 Advanced Person Search filters can be exercised
 * against real data.
 *
 * Safety guarantees:
 *   - Resolves persons by known QA fixture identity (name + QA notes tag).
 *   - Fails fast if any expected QA record is not found.
 *   - Never uses unscoped updateMany; every update is scoped to a specific ID.
 *   - Never touches records outside the QA A–F fixture.
 *   - Idempotent: re-running skips fields already set, and upserts aliases/roles.
 *   - Never creates new DrugCases or modifies case data.
 *   - No credentials embedded; uses project .env.local via dotenv.
 *
 * Run: npx tsx scripts/di74_enrich_person_search_qa.mjs
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createDatabaseClient } from "../lib/database/database.js";
import { generateDrugId } from "../lib/drug_intelligence/drug_id.js";

const db = createDatabaseClient();
const ACTOR_ID = "qa-enrichment:di74";
const ACTOR_NAME = "DI-7.4 QA Enrichment";

// ── 1. Resolve QA persons by name + notes tag ────────────────────────────────

const allPersonA = await db.drugPerson.findMany({ where: { primaryFullName: "นาย ทดสอบ หนึ่ง" } });
const personA = allPersonA.find((p) => p.notes?.includes("แดง") && !p.notes?.includes("duplicate-match"));
const personF = allPersonA.find((p) => p.notes?.includes("duplicate-match"));
const personB = (await db.drugPerson.findMany({ where: { primaryFullName: "นาย ทดสอบ สอง" } }))[0];
const personC = (await db.drugPerson.findMany({ where: { primaryFullName: "นาย ทดสอบ สาม" } }))[0];
const personD = (await db.drugPerson.findMany({ where: { primaryFullName: "นาย ทดสอบ สี่" } }))[0];
const personE = (await db.drugPerson.findMany({ where: { primaryFullName: "นาย ทดสอบ ห้า" } }))[0];

// Safety: abort if any expected record is missing.
const checks = { A: personA, B: personB, C: personC, D: personD, E: personE, F: personF };
for (const [label, person] of Object.entries(checks)) {
  if (!person) {
    console.error(`ERROR: QA Person ${label} not found in database. Aborting.`);
    process.exit(1);
  }
}
console.log("✓ QA persons A–F resolved.");
console.log({ A: personA.id, B: personB.id, C: personC.id, D: personD.id, E: personE.id, F: personF.id });

// ── 2. Helper: scoped profile update (only updates this specific ID) ─────────

async function updatePersonFields(personId, fields) {
  // Scoped by explicit id — never touches other records.
  await db.drugPerson.update({
    where: { id: personId },
    data: { ...fields, updatedBy: ACTOR_ID, updatedByName: ACTOR_NAME },
  });
}

// ── 3. Helper: idempotent alias add ──────────────────────────────────────────

async function ensureAlias(personId, fullName) {
  const existing = await db.drugPersonAlias.findMany({ where: { personId } });
  if (existing.some((a) => a.fullName === fullName)) {
    console.log(`  alias "${fullName}" already exists for ${personId}`);
    return;
  }
  await db.drugPersonAlias.create({
    data: {
      id: generateDrugId(),
      personId,
      fullName,
      isPrimary: false,
      createdBy: ACTOR_ID,
    },
  });
  console.log(`  + alias "${fullName}" added`);
}

// ── 4. Helper: idempotent network role add ───────────────────────────────────

async function ensureNetworkRole(personId, role, source, verificationStatus) {
  const existing = await db.drugPersonNetworkRole.findMany({ where: { personId } });
  if (existing.some((r) => r.role === role && r.source === source)) {
    console.log(`  network role ${role}/${source} already exists for ${personId}`);
    return;
  }
  await db.drugPersonNetworkRole.create({
    data: {
      id: generateDrugId(),
      personId,
      sourceCaseId: null,
      role,
      source,
      verificationStatus,
      note: "DI-7.4 QA enrichment",
      createdBy: ACTOR_ID,
      createdByName: ACTOR_NAME,
    },
  });
  console.log(`  + network role ${role}/${source}/${verificationStatus}`);
}

// ── 5. Helper: idempotent network group upsert + membership ──────────────────

async function ensureNetworkGroup(name) {
  const existing = await db.drugNetworkGroup.findMany({ where: {} });
  const found = existing.find((g) => g.name === name);
  if (found) {
    console.log(`  network group "${name}" already exists: ${found.id}`);
    return found.id;
  }
  const id = generateDrugId();
  await db.drugNetworkGroup.create({
    data: {
      id,
      name,
      aliases: null,
      description: "DI-7.4 QA enrichment fixture",
      note: "TEST / QA ONLY",
      createdBy: ACTOR_ID,
    },
  });
  console.log(`  + network group "${name}" created: ${id}`);
  return id;
}

async function ensureNetworkMembership(personId, networkGroupId) {
  const existing = await db.drugPersonNetworkMembership.findMany({
    where: { personId, networkGroupId },
  });
  if (existing.length > 0) {
    console.log(`  membership ${personId} → ${networkGroupId} already exists`);
    return;
  }
  await db.drugPersonNetworkMembership.create({
    data: {
      id: generateDrugId(),
      personId,
      networkGroupId,
      source: "TESTIMONY",
      status: "ACTIVE",
      note: "DI-7.4 QA enrichment",
      firstObservedAt: null,
      lastObservedAt: null,
      createdBy: ACTOR_ID,
    },
  });
  console.log(`  + membership ${personId} → ${networkGroupId}`);
}

// ── 6. Enrich Person A ───────────────────────────────────────────────────────
console.log("\n--- Person A: นาย ทดสอบ หนึ่ง ---");
if (!personA.nickname || !personA.sex || !personA.nationality) {
  await updatePersonFields(personA.id, {
    nickname: personA.nickname ?? "แดง",
    sex: personA.sex ?? "MALE",
    nationality: personA.nationality ?? "ไทย",
  });
  console.log("  + updated nickname/sex/nationality");
} else {
  console.log("  profile fields already set");
}
await ensureNetworkRole(personA.id, "COURIER", "TESTIMONY", "UNVERIFIED");

// ── 7. Enrich Person B ───────────────────────────────────────────────────────
console.log("\n--- Person B: นาย ทดสอบ สอง ---");
if (!personB.sex || !personB.nationality) {
  await updatePersonFields(personB.id, {
    sex: personB.sex ?? "MALE",
    nationality: personB.nationality ?? "ไทย",
  });
  console.log("  + updated sex/nationality");
} else {
  console.log("  profile fields already set");
}
await ensureNetworkRole(personB.id, "RETAIL_DEALER", "INVESTIGATION", "SUPPORTED");

// ── 8. Enrich Person C ───────────────────────────────────────────────────────
console.log("\n--- Person C: นาย ทดสอบ สาม ---");
if (!personC.sex || !personC.nationality) {
  await updatePersonFields(personC.id, {
    sex: personC.sex ?? "FEMALE",
    nationality: personC.nationality ?? "พม่า",
  });
  console.log("  + updated sex/nationality");
} else {
  console.log("  profile fields already set");
}
await ensureAlias(personC.id, "ไอ้แดง");

// ── 9. Enrich Person D ───────────────────────────────────────────────────────
console.log("\n--- Person D: นาย ทดสอบ สี่ ---");
if (!personD.sex || !personD.nationality) {
  await updatePersonFields(personD.id, {
    sex: personD.sex ?? "MALE",
    nationality: personD.nationality ?? "ลาว",
    // dateOfBirth MUST remain null — using approximateAge only
    approximateAge: personD.approximateAge ?? 35,
  });
  console.log("  + updated sex/nationality/approximateAge");
} else {
  console.log("  profile fields already set");
}

// ── 10. Enrich Person E ──────────────────────────────────────────────────────
console.log("\n--- Person E: นาย ทดสอบ ห้า ---");
if (!personE.sex || !personE.nationality) {
  await updatePersonFields(personE.id, {
    sex: personE.sex ?? "MALE",
    nationality: personE.nationality ?? "ไทย",
  });
  console.log("  + updated sex/nationality (control person)");
} else {
  console.log("  profile fields already set");
}

// ── 11. Enrich Person F ──────────────────────────────────────────────────────
console.log("\n--- Person F: นาย ทดสอบ หนึ่ง (duplicate fixture) ---");
if (!personF.nickname || !personF.sex || !personF.nationality) {
  await updatePersonFields(personF.id, {
    nickname: personF.nickname ?? "เขียว",
    sex: personF.sex ?? "FEMALE",
    nationality: personF.nationality ?? "ไทย",
  });
  console.log("  + updated nickname/sex/nationality");
} else {
  console.log("  profile fields already set");
}

// ── 12. Network group QA fixture ─────────────────────────────────────────────
console.log("\n--- Network group QA fixture ---");
const groupId = await ensureNetworkGroup("เครือข่าย QA ชุมพร");
await ensureNetworkMembership(personA.id, groupId);
await ensureNetworkMembership(personB.id, groupId);
// Person E deliberately NOT added to this group (control/negative test)
console.log(`  network group ID: ${groupId}`);

// ── 13. Verify final state ───────────────────────────────────────────────────
console.log("\n=== FINAL VERIFICATION ===");
for (const [label, person] of [["A", personA], ["B", personB], ["C", personC], ["D", personD], ["E", personE], ["F", personF]]) {
  const fresh = await db.drugPerson.findUnique({ where: { id: person.id } });
  const aliases = await db.drugPersonAlias.findMany({ where: { personId: person.id } });
  const roles = await db.drugPersonNetworkRole.findMany({ where: { personId: person.id } });
  const memberships = await db.drugPersonNetworkMembership.findMany({ where: { personId: person.id } });
  console.log(`Person ${label}:`, {
    name: fresh.primaryFullName,
    nickname: fresh.nickname,
    sex: fresh.sex,
    nationality: fresh.nationality,
    approximateAge: fresh.approximateAge,
    dateOfBirth: fresh.dateOfBirth,
    aliases: aliases.map((a) => a.fullName),
    networkRoles: roles.map((r) => `${r.role}/${r.source}/${r.verificationStatus}`),
    networkGroups: memberships.map((m) => m.networkGroupId),
  });
}

console.log("\n✓ DI-7.4 QA enrichment complete.");
console.log("Network group ID for DI-7.4 tests:", groupId);
