/**
 * Unit tests for the Phase 12 repositories over the in-memory fake client
 * (no live database). Verifies upsert idempotency and the unique-constraint
 * behavior each repository relies on.
 *
 * Run with:
 *   npx tsx --test lib/database/__tests__/repositories.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { OfficerRepository, type OfficerInput } from "@/lib/database/repositories/officer_repository";
import { TimelineRepository } from "@/lib/database/repositories/timeline_repository";
import { UnitRepository } from "@/lib/database/repositories/unit_repository";
import { PhoneRepository } from "@/lib/database/repositories/phone_repository";
import { ImportJobRepository } from "@/lib/database/repositories/import_job_repository";
import { ImportLogRepository } from "@/lib/database/repositories/import_log_repository";

function officerInput(ov: Partial<OfficerInput> = {}): OfficerInput {
  return {
    officerId: "ภาค1/5",
    rank: "ร.ต.ท.",
    firstName: "อนิรุทธิ์",
    lastName: "ขาวจันทร์คง",
    currentPosition: "ผบ.ร้อย",
    currentUnit: "ตชด.447",
    phone: "081-540-7336",
    careerYears: 19,
    qualityScore: 90,
    knowledgeScore: 80,
    region: "ภาค1",
    confidence: 80,
    ...ov,
  };
}

test("OfficerRepository.upsert creates once then updates (no duplicate)", async () => {
  const db = new InMemoryDatabaseClient();
  const repo = new OfficerRepository(db);

  const first = await repo.upsert(officerInput());
  assert.equal(first.created, true);

  const second = await repo.upsert(officerInput({ rank: "พ.ต.ท." }));
  assert.equal(second.created, false);

  assert.equal(await repo.count(), 1); // still one officer
  const found = await repo.findByOfficerId("ภาค1/5");
  assert.equal(found?.rank, "พ.ต.ท."); // updated in place
});

test("TimelineRepository.replaceForOfficer replaces rather than appends", async () => {
  const db = new InMemoryDatabaseClient();
  const officer = await new OfficerRepository(db).upsert(officerInput());
  const repo = new TimelineRepository(db);

  await repo.replaceForOfficer(officer.officer.id, [
    { sequence: 0, year: "2564", yearValue: 2564, position: "a", unit: "U1" },
    { sequence: 1, year: "2560", yearValue: 2560, position: "b", unit: null },
  ]);
  assert.equal(await repo.countForOfficer(officer.officer.id), 2);

  // Re-import with a single entry: old rows are gone, no duplicates.
  await repo.replaceForOfficer(officer.officer.id, [
    { sequence: 0, year: "2565", yearValue: 2565, position: "c", unit: "U2" },
  ]);
  assert.equal(await repo.countForOfficer(officer.officer.id), 1);
});

test("UnitRepository.upsert deduplicates by name", async () => {
  const db = new InMemoryDatabaseClient();
  const repo = new UnitRepository(db);

  const a = await repo.upsert("ตชด.447", 1);
  const b = await repo.upsert("ตชด.447", 2);
  assert.equal(a.created, true);
  assert.equal(b.created, false);
  assert.equal(await repo.count(), 1);
});

test("PhoneRepository.upsert is unique per officer+number", async () => {
  const db = new InMemoryDatabaseClient();
  const repo = new PhoneRepository(db);

  const first = await repo.upsert(1, "081-540-7336");
  const dup = await repo.upsert(1, "081-540-7336");
  assert.equal(first.created, true);
  assert.equal(dup.created, false);
  assert.equal(await repo.countForOfficer(1), 1);

  // Same number, different officer is a distinct row.
  const other = await repo.upsert(2, "081-540-7336");
  assert.equal(other.created, true);
});

test("ImportJobRepository start/finish records tallies", async () => {
  const db = new InMemoryDatabaseClient();
  const repo = new ImportJobRepository(db);

  const job = await repo.start();
  assert.ok(job.id > 0);

  const finished = await repo.finish(job.id, { images: 10, imported: 8, skipped: 2, errors: 0 });
  assert.equal(finished.imported, 8);
  assert.ok(finished.finishedAt);
});

test("ImportLogRepository records one line per officer per action", async () => {
  const db = new InMemoryDatabaseClient();
  const jobRepo = new ImportJobRepository(db);
  const logRepo = new ImportLogRepository(db);

  const job = await jobRepo.start();
  await logRepo.record(job.id, "ภาค1/5", "created");
  await logRepo.record(job.id, "ภาค1/7", "updated");
  await logRepo.record(job.id, "ภาค1/9", "error", "boom");

  assert.equal(await logRepo.countForJob(job.id), 3);
});
