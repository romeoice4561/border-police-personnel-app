/**
 * Unit tests for EducationRepository/TrainingRepository (Phase 23A) over the
 * in-memory fake client. Verifies replace-all semantics mirror
 * TimelineRepository exactly.
 *
 * Run with:
 *   npx tsx --test lib/database/__tests__/education_training_repositories.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { OfficerRepository, type OfficerInput } from "@/lib/database/repositories/officer_repository";
import { EducationRepository } from "@/lib/database/repositories/education_repository";
import { TrainingRepository } from "@/lib/database/repositories/training_repository";

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
    driveFileId: null,
    thumbnailUrl: null,
    webViewUrl: null,
    ...ov,
  };
}

test("EducationRepository.replaceForOfficer replaces rather than appends", async () => {
  const db = new InMemoryDatabaseClient();
  const officer = await new OfficerRepository(db).upsert(officerInput());
  const repo = new EducationRepository(db);

  await repo.replaceForOfficer(officer.officer.id, [
    { year: "2550", institution: "โรงเรียนนายร้อยตำรวจ", degree: "ปริญญาตรี", notes: null },
    { year: "2554", institution: "มหาวิทยาลัยรามคำแหง", degree: "ปริญญาโท", notes: "รัฐประศาสนศาสตร์" },
  ]);
  assert.equal(await repo.countForOfficer(officer.officer.id), 2);

  await repo.replaceForOfficer(officer.officer.id, [
    { year: "2560", institution: "จุฬาลงกรณ์มหาวิทยาลัย", degree: null, notes: null },
  ]);
  assert.equal(await repo.countForOfficer(officer.officer.id), 1);
});

test("TrainingRepository.replaceForOfficer replaces rather than appends", async () => {
  const db = new InMemoryDatabaseClient();
  const officer = await new OfficerRepository(db).upsert(officerInput());
  const repo = new TrainingRepository(db);

  await repo.replaceForOfficer(officer.officer.id, [
    { year: "2560", course: "หลักสูตรผู้บังคับหมู่", organization: "กก.ตชด.44", notes: null },
  ]);
  assert.equal(await repo.countForOfficer(officer.officer.id), 1);

  await repo.replaceForOfficer(officer.officer.id, []);
  assert.equal(await repo.countForOfficer(officer.officer.id), 0);
});

test("deleteForOfficer removes all rows for the given officer only", async () => {
  const db = new InMemoryDatabaseClient();
  const a = await new OfficerRepository(db).upsert(officerInput({ officerId: "ภาค1/1" }));
  const b = await new OfficerRepository(db).upsert(officerInput({ officerId: "ภาค1/2" }));
  const repo = new EducationRepository(db);

  await repo.replaceForOfficer(a.officer.id, [{ year: null, institution: "A", degree: null, notes: null }]);
  await repo.replaceForOfficer(b.officer.id, [{ year: null, institution: "B", degree: null, notes: null }]);

  await repo.deleteForOfficer(a.officer.id);
  assert.equal(await repo.countForOfficer(a.officer.id), 0);
  assert.equal(await repo.countForOfficer(b.officer.id), 1);
});
