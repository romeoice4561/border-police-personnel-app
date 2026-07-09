/**
 * Unit tests for ProfilePhotoService (Phase 21C) over the in-memory
 * repository. Verifies ingest is idempotent and unconditional — it never
 * filters, skips, or rejects a photo for any reason.
 *
 * Run with:
 *   npx tsx --test lib/profile_photo/__tests__/profile_photo_service.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryProfilePhotoRepository } from "@/lib/profile_photo/profile_photo_repository";
import { ProfilePhotoService } from "@/lib/profile_photo/profile_photo_service";
import { MatchStatus, OcrStatus, PortraitClassification, type ProfilePhotoInput } from "@/lib/profile_photo/profile_photo_types";

function photo(ov: Partial<ProfilePhotoInput> = {}): ProfilePhotoInput {
  return {
    driveFileId: "file-1",
    thumbnailUrl: null,
    webViewUrl: null,
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

function service() {
  return new ProfilePhotoService({ repository: new InMemoryProfilePhotoRepository() });
}

test("ingest creates every photo unconditionally, regardless of OCR/match status", async () => {
  const svc = service();
  const result = await svc.ingest([
    photo({ driveFileId: "a", ocrStatus: OcrStatus.Failed, matchStatus: MatchStatus.Unknown }),
    photo({ driveFileId: "b", ocrStatus: OcrStatus.Pending, matchStatus: MatchStatus.Unassigned }),
    photo({ driveFileId: "c", ocrStatus: OcrStatus.Completed, matchStatus: MatchStatus.Conflict }),
    photo({ driveFileId: "d", ocrStatus: OcrStatus.Completed, matchStatus: MatchStatus.AutoMatched, matchedOfficerId: "ภาค1/5", confidence: 100 }),
  ]);
  assert.equal(result.created, 4);
  assert.equal(await svc.count(), 4);
});

test("ingest is idempotent (re-running creates no duplicates, updates in place)", async () => {
  const svc = service();
  await svc.ingest([photo({ driveFileId: "a" })]);
  const second = await svc.ingest([photo({ driveFileId: "a", ocrStatus: OcrStatus.Completed, ocrText: "new text" })]);
  assert.equal(second.created, 0);
  assert.equal(second.updated, 1);
  assert.equal(await svc.count(), 1);
  const found = await svc.getByDriveFileId("a");
  assert.equal(found?.ocrText, "new text");
});

test("list/getById/getByDriveFileId delegate to the repository", async () => {
  const svc = service();
  await svc.ingest([photo({ driveFileId: "a" }), photo({ driveFileId: "b", matchStatus: MatchStatus.AutoMatched })]);

  const page = await svc.list({ matchStatus: MatchStatus.AutoMatched, page: 1, pageSize: 10 });
  assert.equal(page.total, 1);

  const byDriveId = await svc.getByDriveFileId("a");
  assert.equal(byDriveId?.driveFileId, "a");

  const byId = await svc.getById(byDriveId!.id);
  assert.equal(byId?.driveFileId, "a");
});

test("matchStatusCounts reflects ingested photos across every status", async () => {
  const svc = service();
  await svc.ingest([
    photo({ driveFileId: "a", matchStatus: MatchStatus.AutoMatched }),
    photo({ driveFileId: "b", matchStatus: MatchStatus.Unknown }),
    photo({ driveFileId: "c", matchStatus: MatchStatus.Unknown }),
  ]);
  const counts = await svc.matchStatusCounts();
  assert.equal(counts.find((c) => c.matchStatus === MatchStatus.AutoMatched)?.count, 1);
  assert.equal(counts.find((c) => c.matchStatus === MatchStatus.Unknown)?.count, 2);
});

// ── Phase 24B-2: classification / history / set-current ─────────────────────

test("classify sets classification, classifiedBy, and classifiedAt", async () => {
  const svc = service();
  await svc.ingest([photo({ driveFileId: "a" })]);
  const before = await svc.getByDriveFileId("a");

  const updated = await svc.classify(before!.id, PortraitClassification.Map, "reviewer-1");
  assert.equal(updated?.classification, PortraitClassification.Map);
  assert.equal(updated?.classifiedBy, "reviewer-1");
  assert.ok(updated?.classifiedAt);
});

test("classify returns null for an unknown photo id", async () => {
  const svc = service();
  assert.equal(await svc.classify(9999, PortraitClassification.Map, "reviewer-1"), null);
});

test("classificationCounts reflects every classification, including zero-count ones", async () => {
  const svc = service();
  await svc.ingest([photo({ driveFileId: "a" }), photo({ driveFileId: "b" })]);
  const a = await svc.getByDriveFileId("a");
  await svc.classify(a!.id, PortraitClassification.RealPerson, "r1");

  const counts = await svc.classificationCounts();
  assert.equal(counts.find((c) => c.classification === PortraitClassification.RealPerson)?.count, 1);
  assert.equal(counts.find((c) => c.classification === PortraitClassification.Unknown)?.count, 1);
  assert.equal(counts.find((c) => c.classification === PortraitClassification.Map)?.count, 0);
});

test("history returns every photo ever linked to an officer, newest first, never filtered", async () => {
  const svc = service();
  await svc.ingest([
    photo({ driveFileId: "old", matchedOfficerId: "off-1", matchStatus: MatchStatus.AutoMatched, isProfile: false }),
    photo({ driveFileId: "new", matchedOfficerId: "off-1", matchStatus: MatchStatus.ManualMatched, isProfile: true }),
    photo({ driveFileId: "other", matchedOfficerId: "off-2" }),
  ]);
  const history = await svc.history("off-1");
  assert.equal(history.length, 2);
  assert.ok(history.every((p) => p.matchedOfficerId === "off-1"));
});

test("setCurrent promotes the target photo and demotes every other photo for the same officer, without deleting anything", async () => {
  const svc = service();
  await svc.ingest([
    photo({ driveFileId: "old", matchedOfficerId: "off-1", isProfile: true }),
    photo({ driveFileId: "candidate", matchedOfficerId: "off-1", isProfile: false }),
  ]);
  const candidate = await svc.getByDriveFileId("candidate");

  const updated = await svc.setCurrent(candidate!.id);
  assert.equal(updated?.isProfile, true);

  const old = await svc.getByDriveFileId("old");
  assert.equal(old?.isProfile, false);
  assert.equal(await svc.count(), 2, "no row was deleted");
});

test("setCurrent returns null for a photo with no matchedOfficerId", async () => {
  const svc = service();
  await svc.ingest([photo({ driveFileId: "unlinked", matchedOfficerId: null })]);
  const row = await svc.getByDriveFileId("unlinked");
  assert.equal(await svc.setCurrent(row!.id), null);
});

test("re-ingesting an already-classified photo NEVER regresses its classification or isProfile (upsert safety)", async () => {
  const svc = service();
  await svc.ingest([photo({ driveFileId: "a", matchedOfficerId: "off-1", isProfile: true })]);
  const before = await svc.getByDriveFileId("a");
  await svc.classify(before!.id, PortraitClassification.RealPerson, "reviewer-1");

  // Simulate a re-scan of the same Drive file with fresh (default) importer values.
  await svc.ingest([photo({ driveFileId: "a", matchedOfficerId: "off-1", ocrText: "re-scanned text" })]);

  const after = await svc.getByDriveFileId("a");
  assert.equal(after?.classification, PortraitClassification.RealPerson, "classification must survive re-import");
  assert.equal(after?.isProfile, true, "isProfile must survive re-import");
  assert.equal(after?.ocrText, "re-scanned text", "other scan metadata still refreshes normally");
});
