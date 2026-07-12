/**
 * Unit tests for SalaryHistoryRepository (Phase 28A) over the in-memory
 * fake client. Verifies replace-all semantics (saveSalaryHistory) mirror
 * EducationRepository/TrainingRepository exactly, plus the
 * (officerId, yearBE) upsert path and one-record-per-officer-per-year
 * uniqueness.
 *
 * Run with:
 *   npx tsx --test lib/database/__tests__/salary_history_repository.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { OfficerRepository, type OfficerInput } from "@/lib/database/repositories/officer_repository";
import { SalaryHistoryRepository } from "@/lib/database/repositories/salary_history_repository";

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

test("saveSalaryHistory replaces rather than appends", async () => {
  const db = new InMemoryDatabaseClient();
  const officer = await new OfficerRepository(db).upsert(officerInput());
  const repo = new SalaryHistoryRepository(db);

  await repo.saveSalaryHistory(officer.officer.id, [
    { yearBE: 2568, salaryStep: 1.0, remarks: null },
    { yearBE: 2569, salaryStep: 2.0, remarks: "ผลงานดีเด่น" },
  ]);
  assert.equal(await repo.countForOfficer(officer.officer.id), 2);

  await repo.saveSalaryHistory(officer.officer.id, [{ yearBE: 2570, salaryStep: 0.5, remarks: null }]);
  assert.equal(await repo.countForOfficer(officer.officer.id), 1);
});

test("getSalaryHistory returns every row for the given officer", async () => {
  const db = new InMemoryDatabaseClient();
  const officer = await new OfficerRepository(db).upsert(officerInput());
  const repo = new SalaryHistoryRepository(db);

  await repo.saveSalaryHistory(officer.officer.id, [
    { yearBE: 2568, salaryStep: 1.0, remarks: null },
    { yearBE: 2569, salaryStep: 2.0, remarks: null },
  ]);

  const rows = await repo.getSalaryHistory(officer.officer.id);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.yearBE).sort(), [2568, 2569]);
});

test("deleteSalaryHistory removes all rows for the given officer only", async () => {
  const db = new InMemoryDatabaseClient();
  const a = await new OfficerRepository(db).upsert(officerInput({ officerId: "ภาค1/1" }));
  const b = await new OfficerRepository(db).upsert(officerInput({ officerId: "ภาค1/2" }));
  const repo = new SalaryHistoryRepository(db);

  await repo.saveSalaryHistory(a.officer.id, [{ yearBE: 2569, salaryStep: 1.0, remarks: null }]);
  await repo.saveSalaryHistory(b.officer.id, [{ yearBE: 2569, salaryStep: 2.0, remarks: null }]);

  await repo.deleteSalaryHistory(a.officer.id);
  assert.equal(await repo.countForOfficer(a.officer.id), 0);
  assert.equal(await repo.countForOfficer(b.officer.id), 1);
});

test("upsertSalaryHistory creates a new row when the (officerId, yearBE) pair doesn't exist yet", async () => {
  const db = new InMemoryDatabaseClient();
  const officer = await new OfficerRepository(db).upsert(officerInput());
  const repo = new SalaryHistoryRepository(db);

  const created = await repo.upsertSalaryHistory(officer.officer.id, { yearBE: 2569, salaryStep: 1.0, remarks: null });
  assert.equal(created.yearBE, 2569);
  assert.equal(created.salaryStep, 1.0);
  assert.equal(await repo.countForOfficer(officer.officer.id), 1);
});

test("upsertSalaryHistory updates the existing row rather than creating a duplicate for the same year (Part 1: one record per officer per year)", async () => {
  const db = new InMemoryDatabaseClient();
  const officer = await new OfficerRepository(db).upsert(officerInput());
  const repo = new SalaryHistoryRepository(db);

  await repo.upsertSalaryHistory(officer.officer.id, { yearBE: 2569, salaryStep: 1.0, remarks: null });
  const updated = await repo.upsertSalaryHistory(officer.officer.id, { yearBE: 2569, salaryStep: 2.0, remarks: "แก้ไข" });

  assert.equal(updated.salaryStep, 2.0);
  assert.equal(updated.remarks, "แก้ไข");
  assert.equal(await repo.countForOfficer(officer.officer.id), 1);
});

test("historical years are preserved across multiple upserts to different years (Background: 'Historical years are preserved permanently')", async () => {
  const db = new InMemoryDatabaseClient();
  const officer = await new OfficerRepository(db).upsert(officerInput());
  const repo = new SalaryHistoryRepository(db);

  await repo.upsertSalaryHistory(officer.officer.id, { yearBE: 2566, salaryStep: 1.0, remarks: null });
  await repo.upsertSalaryHistory(officer.officer.id, { yearBE: 2567, salaryStep: 1.5, remarks: null });
  await repo.upsertSalaryHistory(officer.officer.id, { yearBE: 2568, salaryStep: 2.0, remarks: null });

  const rows = await repo.getSalaryHistory(officer.officer.id);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.yearBE).sort(), [2566, 2567, 2568]);
});
