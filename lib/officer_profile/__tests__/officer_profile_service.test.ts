/**
 * Unit tests for OfficerProfileService (Phase 23A) over the in-memory fake
 * DatabaseClient. Verifies the batched, transactional save: every section
 * present in the input is written atomically; an omitted section is left
 * completely unchanged; a save against a nonexistent officer throws
 * OfficerNotFoundError and writes nothing.
 *
 * Run with:
 *   npx tsx --test lib/officer_profile/__tests__/officer_profile_service.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { OfficerRepository, type OfficerInput } from "@/lib/database/repositories/officer_repository";
import { TimelineRepository } from "@/lib/database/repositories/timeline_repository";
import { EducationRepository } from "@/lib/database/repositories/education_repository";
import { TrainingRepository } from "@/lib/database/repositories/training_repository";
import { OfficerProfileService } from "@/lib/officer_profile/officer_profile_service";
import { OfficerNotFoundError } from "@/lib/officer_profile/officer_profile_types";

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

async function seededOfficer(db: InMemoryDatabaseClient) {
  return new OfficerRepository(db).upsert(officerInput());
}

test("save() writes profile + timeline + education + training together when all are present", async () => {
  const db = new InMemoryDatabaseClient();
  await seededOfficer(db);
  const service = new OfficerProfileService({ db });

  const result = await service.save("ภาค1/5", {
    profile: { phone: "089-000-0000" },
    timeline: [{ sequence: 0, year: "2560", yearValue: 2560, position: "ผบ.ร้อย", unit: "ตชด.447" }],
    education: [{ year: null, institution: "รร.นายร้อยตำรวจ", degree: null, notes: null }],
    training: [{ year: null, course: "หลักสูตร A", organization: null, notes: null }],
  });

  assert.equal(result.profileUpdated, true);
  assert.equal(result.timelineRowCount, 1);
  assert.equal(result.educationRowCount, 1);
  assert.equal(result.trainingRowCount, 1);

  const officer = await new OfficerRepository(db).findByOfficerId("ภาค1/5");
  assert.equal(officer?.phone, "089-000-0000");
  assert.equal(await new TimelineRepository(db).countForOfficer(officer!.id), 1);
  assert.equal(await new EducationRepository(db).countForOfficer(officer!.id), 1);
  assert.equal(await new TrainingRepository(db).countForOfficer(officer!.id), 1);
});

test("save() leaves an omitted section completely unchanged", async () => {
  const db = new InMemoryDatabaseClient();
  const { officer: seeded } = await seededOfficer(db);
  await new TimelineRepository(db).replaceForOfficer(seeded.id, [
    { sequence: 0, year: "2555", yearValue: 2555, position: "รอง ผบ.ร้อย", unit: "ตชด.447" },
  ]);
  const service = new OfficerProfileService({ db });

  // Save ONLY the profile — timeline is omitted and must be untouched.
  const result = await service.save("ภาค1/5", { profile: { phone: "089-111-1111" } });

  assert.equal(result.profileUpdated, true);
  assert.equal(result.timelineRowCount, null);
  assert.equal(result.educationRowCount, null);
  assert.equal(result.trainingRowCount, null);

  const timelineCount = await new TimelineRepository(db).countForOfficer(seeded.id);
  assert.equal(timelineCount, 1); // still the one seeded row — replace-all never ran
});

test("save() throws OfficerNotFoundError for a nonexistent officer and writes nothing", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new OfficerProfileService({ db });

  await assert.rejects(
    () => service.save("ไม่มี/999", { profile: { phone: "080-000-0000" } }),
    OfficerNotFoundError
  );
  assert.equal(db.counts().officers, 0);
});

test("save() with an entirely empty input is a valid no-op (every section optional)", async () => {
  const db = new InMemoryDatabaseClient();
  await seededOfficer(db);
  const service = new OfficerProfileService({ db });

  const result = await service.save("ภาค1/5", {});
  assert.equal(result.profileUpdated, false);
  assert.equal(result.timelineRowCount, null);
  assert.equal(result.educationRowCount, null);
  assert.equal(result.trainingRowCount, null);
});
