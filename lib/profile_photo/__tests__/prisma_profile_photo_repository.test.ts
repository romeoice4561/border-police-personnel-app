/**
 * Unit tests for PrismaProfilePhotoRepository (Phase 21C) over the fake
 * ProfilePhoto DB client. No live database.
 *
 * Run with:
 *   npx tsx --test lib/profile_photo/__tests__/prisma_profile_photo_repository.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { FakeProfilePhotoDbClient } from "@/lib/profile_photo/__tests__/fake_profile_photo_db";
import { PrismaProfilePhotoRepository } from "@/lib/profile_photo/prisma_profile_photo_repository";
import { MatchStatus, OcrStatus, PortraitClassification, type ProfilePhotoInput } from "@/lib/profile_photo/profile_photo_types";

function photo(ov: Partial<ProfilePhotoInput> = {}): ProfilePhotoInput {
  return {
    driveFileId: "file-1",
    thumbnailUrl: "https://drive.google.com/thumbnail?id=file-1&sz=w256",
    webViewUrl: "https://drive.google.com/file/d/file-1/view",
    filename: "38.png",
    folderPath: "Profile รายบุคคล ภาค 1/38.png",
    region: "ภาค 1",
    company: null,
    battalion: null,
    ocrText: null,
    ocrStatus: OcrStatus.Pending,
    matchStatus: MatchStatus.Unassigned,
    matchedOfficerId: null,
    confidence: null,
    sourceType: "DRIVE_SCAN",
    storagePath: null,
    mimeType: null,
    width: null,
    height: null,
    uploadedBy: null,
    isProfile: false,
    classification: PortraitClassification.Unknown,
    classifiedBy: null,
    classifiedAt: null,
    ...ov,
  };
}

test("upsert is idempotent (create then update, no duplicate)", async () => {
  const db = new FakeProfilePhotoDbClient();
  const repo = new PrismaProfilePhotoRepository(db);

  const first = await repo.upsert(photo());
  assert.equal(first.created, true);

  const second = await repo.upsert(photo({ ocrStatus: OcrStatus.Completed, ocrText: "some text" }));
  assert.equal(second.created, false);
  assert.equal(db.size(), 1);
  assert.equal(second.photo.ocrText, "some text");
});

test("findByDriveFileId / findById round-trip", async () => {
  const db = new FakeProfilePhotoDbClient();
  const repo = new PrismaProfilePhotoRepository(db);
  const { photo: created } = await repo.upsert(photo());

  assert.equal((await repo.findByDriveFileId("file-1"))?.filename, "38.png");
  assert.equal((await repo.findById(created.id))?.driveFileId, "file-1");
  assert.equal(await repo.findByDriveFileId("nope"), null);
});

test("list filters by matchStatus/region/company/battalion and paginates", async () => {
  const db = new FakeProfilePhotoDbClient();
  const repo = new PrismaProfilePhotoRepository(db);

  await repo.upsert(photo({ driveFileId: "a", matchStatus: MatchStatus.AutoMatched, region: "ภาค 1" }));
  await repo.upsert(photo({ driveFileId: "b", matchStatus: MatchStatus.Unknown, region: "ภาค 1" }));
  await repo.upsert(photo({ driveFileId: "c", matchStatus: MatchStatus.AutoMatched, region: "ภาค 2" }));

  const auto = await repo.list({ matchStatus: MatchStatus.AutoMatched, page: 1, pageSize: 10 });
  assert.equal(auto.total, 2);

  const region1 = await repo.list({ region: "ภาค 1", page: 1, pageSize: 10 });
  assert.equal(region1.total, 2);

  const page1 = await repo.list({ page: 1, pageSize: 2 });
  assert.equal(page1.data.length, 2);
  assert.equal(page1.totalPages, 2);
});

test("list search matches filename/folderPath/matchedOfficerId", async () => {
  const db = new FakeProfilePhotoDbClient();
  const repo = new PrismaProfilePhotoRepository(db);
  await repo.upsert(photo({ driveFileId: "a", filename: "38.png", matchedOfficerId: "ภาค1/5" }));
  await repo.upsert(photo({ driveFileId: "b", filename: "99.png" }));

  const bySearch = await repo.list({ search: "ภาค1/5", page: 1, pageSize: 10 });
  assert.equal(bySearch.total, 1);
  assert.equal(bySearch.data[0].driveFileId, "a");
});

test("matchStatusCounts covers every MatchStatus value, including zero counts", async () => {
  const db = new FakeProfilePhotoDbClient();
  const repo = new PrismaProfilePhotoRepository(db);
  await repo.upsert(photo({ driveFileId: "a", matchStatus: MatchStatus.AutoMatched }));
  await repo.upsert(photo({ driveFileId: "b", matchStatus: MatchStatus.AutoMatched }));
  await repo.upsert(photo({ driveFileId: "c", matchStatus: MatchStatus.Unknown }));

  const counts = await repo.matchStatusCounts();
  assert.equal(counts.length, Object.values(MatchStatus).length);
  assert.equal(counts.find((c) => c.matchStatus === MatchStatus.AutoMatched)?.count, 2);
  assert.equal(counts.find((c) => c.matchStatus === MatchStatus.Unknown)?.count, 1);
  assert.equal(counts.find((c) => c.matchStatus === MatchStatus.Conflict)?.count, 0);
});

test("count() returns the total row count", async () => {
  const db = new FakeProfilePhotoDbClient();
  const repo = new PrismaProfilePhotoRepository(db);
  await repo.upsert(photo({ driveFileId: "a" }));
  await repo.upsert(photo({ driveFileId: "b" }));
  assert.equal(await repo.count(), 2);
});

// ── Phase 24B-2: classification / history / set-current ─────────────────────

test("list filters by classification", async () => {
  const db = new FakeProfilePhotoDbClient();
  const repo = new PrismaProfilePhotoRepository(db);
  await repo.upsert(photo({ driveFileId: "a", classification: PortraitClassification.Map }));
  await repo.upsert(photo({ driveFileId: "b", classification: PortraitClassification.Unknown }));

  const maps = await repo.list({ classification: PortraitClassification.Map, page: 1, pageSize: 10 });
  assert.equal(maps.total, 1);
  assert.equal(maps.data[0].driveFileId, "a");
});

test("setClassification persists classification/classifiedBy/classifiedAt via update()", async () => {
  const db = new FakeProfilePhotoDbClient();
  const repo = new PrismaProfilePhotoRepository(db);
  const { photo: created } = await repo.upsert(photo({ driveFileId: "a" }));

  const updated = await repo.setClassification(created.id, PortraitClassification.Organization, "reviewer-9");
  assert.equal(updated?.classification, PortraitClassification.Organization);
  assert.equal(updated?.classifiedBy, "reviewer-9");
  assert.ok(updated?.classifiedAt);
});

test("setClassification returns null for a missing id", async () => {
  const db = new FakeProfilePhotoDbClient();
  const repo = new PrismaProfilePhotoRepository(db);
  assert.equal(await repo.setClassification(999, PortraitClassification.Map, null), null);
});

test("historyForOfficer returns every row for the officer, unfiltered", async () => {
  const db = new FakeProfilePhotoDbClient();
  const repo = new PrismaProfilePhotoRepository(db);
  await repo.upsert(photo({ driveFileId: "a", matchedOfficerId: "off-1" }));
  await repo.upsert(photo({ driveFileId: "b", matchedOfficerId: "off-1", matchStatus: MatchStatus.Conflict }));
  await repo.upsert(photo({ driveFileId: "c", matchedOfficerId: "off-2" }));

  const history = await repo.historyForOfficer("off-1");
  assert.equal(history.length, 2);
});

test("setCurrent promotes the target and demotes every other row for the officer via updateMany + update", async () => {
  const db = new FakeProfilePhotoDbClient();
  const repo = new PrismaProfilePhotoRepository(db);
  const { photo: oldCurrent } = await repo.upsert(photo({ driveFileId: "old", matchedOfficerId: "off-1", isProfile: true }));
  const { photo: candidate } = await repo.upsert(photo({ driveFileId: "new", matchedOfficerId: "off-1", isProfile: false }));

  const updated = await repo.setCurrent(candidate.id);
  assert.equal(updated?.isProfile, true);

  const oldRow = await repo.findById(oldCurrent.id);
  assert.equal(oldRow?.isProfile, false);
});

test("setCurrent returns null when the photo has no matchedOfficerId", async () => {
  const db = new FakeProfilePhotoDbClient();
  const repo = new PrismaProfilePhotoRepository(db);
  const { photo: created } = await repo.upsert(photo({ driveFileId: "a", matchedOfficerId: null }));
  assert.equal(await repo.setCurrent(created.id), null);
});

test("re-upserting an already-classified row preserves classification/isProfile (never regresses on re-scan)", async () => {
  const db = new FakeProfilePhotoDbClient();
  const repo = new PrismaProfilePhotoRepository(db);
  const { photo: created } = await repo.upsert(photo({ driveFileId: "a", matchedOfficerId: "off-1", isProfile: true }));
  await repo.setClassification(created.id, PortraitClassification.RealPerson, "r1");

  await repo.upsert(photo({ driveFileId: "a", matchedOfficerId: "off-1", ocrText: "rescanned" }));

  const after = await repo.findByDriveFileId("a");
  assert.equal(after?.classification, PortraitClassification.RealPerson);
  assert.equal(after?.isProfile, true);
  assert.equal(after?.ocrText, "rescanned");
});

test("classificationCounts covers every PortraitClassification value, including zero counts", async () => {
  const db = new FakeProfilePhotoDbClient();
  const repo = new PrismaProfilePhotoRepository(db);
  await repo.upsert(photo({ driveFileId: "a", classification: PortraitClassification.RealPerson }));
  await repo.upsert(photo({ driveFileId: "b", classification: PortraitClassification.RealPerson }));

  const counts = await repo.classificationCounts();
  assert.equal(counts.length, Object.values(PortraitClassification).length);
  assert.equal(counts.find((c) => c.classification === PortraitClassification.RealPerson)?.count, 2);
  assert.equal(counts.find((c) => c.classification === PortraitClassification.Map)?.count, 0);
});
