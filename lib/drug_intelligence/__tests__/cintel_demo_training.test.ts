import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { normalizePhoneMatchingKey } from "@/lib/drug_intelligence/phone_matching_key";
import {
  CINTEL_DEMO_CASE_NUMBERS,
  CINTEL_DEMO_DATASET,
  CINTEL_DEMO_EXPECTED_ICE_TOTAL_GRAMS,
  CINTEL_DEMO_EXPECTED_TABLET_TOTAL,
  CINTEL_DEMO_FIELD_MAPPING,
  CINTEL_DEMO_PERSON_IDENTIFIERS,
  CINTEL_DEMO_PHONE_RAW,
  CINTEL_DEMO_QA_CASE_NUMBERS,
  iceTotalGrams,
  tabletTotal,
} from "@/lib/drug_intelligence/cintel_demo_training_catalog";
import { assertDemoWriteAllowed, cleanupUsesBroadMatchers, demoPhoneMatchingKeys } from "@/lib/drug_intelligence/cintel_demo_training_ops";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

test("dataset marker and case numbers are exact and unique", () => {
  assert.equal(CINTEL_DEMO_DATASET, "CINTEL-DEMO-TRAINING-2569");
  assert.deepEqual([...CINTEL_DEMO_CASE_NUMBERS], [
    "DI-TEST-001",
    "DI-TEST-002",
    "DI-TEST-003",
    "DI-TEST-004",
    "DI-TEST-005",
    "DI-TEST-006",
  ]);
  assert.equal(new Set(CINTEL_DEMO_CASE_NUMBERS).size, 6);
  assert.equal(new Set(CINTEL_DEMO_PERSON_IDENTIFIERS).size, 6);
});

test("COUNT and MASS totals match the scenario", () => {
  assert.equal(tabletTotal(), CINTEL_DEMO_EXPECTED_TABLET_TOTAL);
  assert.equal(iceTotalGrams(), CINTEL_DEMO_EXPECTED_ICE_TOTAL_GRAMS);
  assert.equal(tabletTotal(), 37500);
  assert.equal(iceTotalGrams(), 1820);
});

test("demo phones normalize to a single TEL001 key", () => {
  assert.equal(normalizePhoneMatchingKey("0900001001"), "66900001001");
  assert.equal(demoPhoneMatchingKeys()[0], "66900001001");
  assert.equal(new Set(CINTEL_DEMO_PHONE_RAW).size, 7);
});

test("QA fixture identifiers are not in the demo allowlist", () => {
  for (const qa of CINTEL_DEMO_QA_CASE_NUMBERS) {
    assert.equal((CINTEL_DEMO_CASE_NUMBERS as readonly string[]).includes(qa), false);
  }
  assert.equal(CINTEL_DEMO_FIELD_MAPPING.graphSuppliedByEdge, "NOT CURRENTLY MODELED");
});

test("cleanup and seed stay scoped to exact catalog ids", () => {
  const cleanup = read("lib/drug_intelligence/cintel_demo_training_ops.ts");
  const seed = read("scripts/cintel_demo_training_seed.ts");
  const script = read("scripts/cintel_demo_training_cleanup.ts");
  const deleteFn = cleanup.slice(
    cleanup.indexOf("export async function deleteDemoDataset"),
    cleanup.indexOf("export function cleanupUsesBroadMatchers"),
  );
  assert.equal(cleanupUsesBroadMatchers(deleteFn), false);
  assert.doesNotMatch(deleteFn, /caseNumber:\s*\{\s*contains:\s*"TEST"/);
  assert.doesNotMatch(deleteFn, /province:/);
  assert.doesNotMatch(deleteFn, /arrestDate:/);
  assert.match(cleanup, /CINTEL_DEMO_DATASET/);
  assert.match(cleanup, /CINTEL_DEMO_PERSON_IDENTIFIERS/);
  assert.equal(CINTEL_DEMO_PERSON_IDENTIFIERS[0], "TEST-PERSON-001");
  assert.match(seed, /existingPersonId/);
  assert.match(seed, /TEST-PERSON-002/);
  assert.match(seed, /STORAGE_LOCATION/);
  assert.match(seed, /assertDemoWriteAllowed/);
  assert.match(script, /--execute/);
  assert.match(script, /Dry-run/);
  assert.doesNotMatch(seed, /prisma db push/);
});

test("seed does not invent a P002-P003 person edge from the shared vehicle", () => {
  const seed = read("scripts/cintel_demo_training_seed.ts");
  assert.doesNotMatch(seed, /ensureSuppliedBy\(ids\.P002, ids\.P003/);
  assert.doesNotMatch(seed, /ensureSuppliedBy\(ids\.P003/);
  assert.match(seed, /ไม่สร้างความสัมพันธ์บุคคลโดยตรงจากรถคันเดียวกัน/);
});

test("write gate refuses remote hosts unless explicitly allowed", () => {
  const remote = "postgresql://u:p@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";
  const previous = process.env.CINTEL_DEMO_ALLOW_REMOTE;
  delete process.env.CINTEL_DEMO_ALLOW_REMOTE;
  assert.throws(() => assertDemoWriteAllowed(remote), /refused write/);
  assert.doesNotThrow(() => assertDemoWriteAllowed("postgresql://u:p@localhost:5432/postgres"));
  process.env.CINTEL_DEMO_ALLOW_REMOTE = "1";
  assert.doesNotThrow(() => assertDemoWriteAllowed(remote));
  if (previous === undefined) delete process.env.CINTEL_DEMO_ALLOW_REMOTE;
  else process.env.CINTEL_DEMO_ALLOW_REMOTE = previous;
});

test("cleanup deletes Restrict notes/tasks by collected ids before cases", () => {
  const cleanup = read("lib/drug_intelligence/cintel_demo_training_ops.ts");
  const taskIdx = cleanup.indexOf("drugInvestigationTask.deleteMany");
  const noteIdx = cleanup.indexOf("drugAnalystNote.deleteMany");
  const caseIdx = cleanup.indexOf("drugCase.deleteMany");
  assert.ok(taskIdx > 0 && noteIdx > taskIdx && caseIdx > noteIdx);
  assert.match(cleanup, /id: \{ in: plan\.investigationTaskIds \}/);
  assert.match(cleanup, /id: \{ in: plan\.analystNoteIds \}/);
});
