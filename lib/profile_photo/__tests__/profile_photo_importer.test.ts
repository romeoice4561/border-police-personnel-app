/**
 * Unit tests for ProfilePhotoImporter (Phase 21C, Part 3/8) — verifies the
 * core invariant: every discovered Profile-content image becomes EXACTLY ONE
 * ProfilePhoto record, unconditionally — even when OCR is missing/failed, no
 * officer signal is supplied, or the match is ambiguous/duplicate/unknown.
 *
 * Run with:
 *   npx tsx --test lib/profile_photo/__tests__/profile_photo_importer.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { FakeProfilePhotoDbClient } from "@/lib/profile_photo/__tests__/fake_profile_photo_db";
import { PrismaProfilePhotoRepository } from "@/lib/profile_photo/prisma_profile_photo_repository";
import { ProfilePhotoService } from "@/lib/profile_photo/profile_photo_service";
import { ProfilePhotoImporter, type OcrTextByFileId, type ClassificationByFileId } from "@/lib/profile_photo/profile_photo_importer";
import { MatchStatus, OcrStatus, PortraitClassification } from "@/lib/profile_photo/profile_photo_types";
import { DriveContentType } from "@/lib/google-drive/drive_content_type";
import type { DriveScanEntry } from "@/lib/google-drive/drive_scan_report";
import type { OfficerSignals } from "@/lib/profile_photo/profile_photo_matcher";

function entry(ov: Partial<DriveScanEntry> & { id: string }): DriveScanEntry {
  return {
    name: `${ov.id}.jpg`,
    mimeType: "image/jpeg",
    size: "1024",
    modifiedTime: "2026-01-01T00:00:00Z",
    parentFolder: "P",
    relativePath: `Profile รายบุคคล ภาค 1/${ov.id}.jpg`,
    isImage: true,
    content_type: DriveContentType.Profile,
    region: "ภาค 1",
    ...ov,
  };
}

function makeImporter() {
  const db = new FakeProfilePhotoDbClient();
  const repository = new PrismaProfilePhotoRepository(db);
  const service = new ProfilePhotoService({ repository });
  return { importer: new ProfilePhotoImporter({ service }), repository, db };
}

function officer(ov: Partial<OfficerSignals> = {}): OfficerSignals {
  return {
    officerId: "ภาค1/5",
    fullName: "อนิรุทธิ์ ขาวจันทร์คง",
    rank: "ร.ต.ท.",
    currentUnit: "ตชด.447",
    region: "ภาค1",
    phone: "081-540-7336",
    timelineUnits: [],
    extraPhones: [],
    ...ov,
  };
}

test("CORE INVARIANT: every discovered Profile image is imported, even with no OCR and no officers supplied", async () => {
  const { importer, db } = makeImporter();
  const entries = [entry({ id: "a" }), entry({ id: "b" }), entry({ id: "c" })];

  const summary = await importer.import(entries);

  assert.equal(summary.profileImages, 3);
  assert.equal(summary.photos_created, 3);
  assert.equal(db.size(), 3);
  assert.equal(summary.match_unassigned, 3); // no officers supplied -> matcher never ran
  assert.equal(summary.ocr_pending, 3); // no OCR supplied -> all pending
});

test("non-Profile and non-image entries are excluded (this importer only handles Profile content)", async () => {
  const { importer, db } = makeImporter();
  const entries = [
    entry({ id: "profile1" }),
    entry({ id: "map1", content_type: DriveContentType.NeighborMap }),
    entry({ id: "pdf1", isImage: false, content_type: DriveContentType.Profile }),
  ];

  const summary = await importer.import(entries);
  assert.equal(summary.discovered, 3);
  assert.equal(summary.profileImages, 1);
  assert.equal(db.size(), 1);
});

test("OCR failure never blocks import — the photo is still created with ocrStatus FAILED", async () => {
  const { importer, repository } = makeImporter();
  const ocrByFileId: OcrTextByFileId = new Map([["a", { text: "", failed: true }]]);

  const summary = await importer.import([entry({ id: "a" })], { ocrByFileId });

  assert.equal(summary.photos_created, 1);
  assert.equal(summary.ocr_failed, 1);
  const photo = await repository.findByDriveFileId("a");
  assert.equal(photo?.ocrStatus, OcrStatus.Failed);
  assert.equal(photo?.matchStatus, MatchStatus.Unassigned);
});

test("Phase 24B-3: classification is threaded through from classificationByFileId, defaulting to UNKNOWN when absent", async () => {
  const { importer, repository } = makeImporter();
  const classificationByFileId: ClassificationByFileId = new Map([["a", PortraitClassification.RealPerson]]);

  await importer.import([entry({ id: "a" }), entry({ id: "b" })], { classificationByFileId });

  const a = await repository.findByDriveFileId("a");
  const b = await repository.findByDriveFileId("b");
  assert.equal(a?.classification, PortraitClassification.RealPerson);
  assert.equal(b?.classification, PortraitClassification.Unknown, "no entry in the map -> default UNKNOWN, unchanged behavior");
});

test("Phase 24B-3: classification never affects import/match outcome (metadata only) — identical matchStatus with and without a MAP classification", async () => {
  const ocrByFileId: OcrTextByFileId = new Map([["a", { text: "อนิรุทธิ์ ขาวจันทร์คง ตชด.447 081-540-7336", failed: false }]]);

  const withoutClassification = makeImporter();
  await withoutClassification.importer.import([entry({ id: "a" })], { ocrByFileId, officers: [officer()] });
  const baseline = await withoutClassification.repository.findByDriveFileId("a");

  const withClassification = makeImporter();
  const classificationByFileId: ClassificationByFileId = new Map([["a", PortraitClassification.Map]]);
  const summary = await withClassification.importer.import([entry({ id: "a" })], {
    ocrByFileId,
    officers: [officer()],
    classificationByFileId,
  });
  const withMap = await withClassification.repository.findByDriveFileId("a");

  assert.equal(summary.photos_created, 1);
  assert.equal(withMap?.classification, PortraitClassification.Map);
  assert.equal(withMap?.matchStatus, baseline?.matchStatus, "classification never blocks or alters matching");
  assert.equal(withMap?.matchedOfficerId, baseline?.matchedOfficerId, "classification never blocks or alters the officer link");
});

test("no officer signal found -> UNKNOWN, but the photo is still imported", async () => {
  const { importer, repository } = makeImporter();
  const ocrByFileId: OcrTextByFileId = new Map([["a", { text: "no relevant text here", failed: false }]]);

  const summary = await importer.import([entry({ id: "a" })], { ocrByFileId, officers: [officer()] });

  assert.equal(summary.photos_created, 1);
  assert.equal(summary.match_unknown, 1);
  const photo = await repository.findByDriveFileId("a");
  assert.equal(photo?.matchStatus, MatchStatus.Unknown);
  assert.equal(photo?.matchedOfficerId, null);
});

test("a clear match -> AUTO_MATCHED, officer link + confidence stored on the ProfilePhoto row only", async () => {
  const { importer, repository } = makeImporter();
  const ocrByFileId: OcrTextByFileId = new Map([
    ["a", { text: "ร.ต.ท. อนิรุทธิ์ ขาวจันทร์คง ตชด.447 081-540-7336", failed: false }],
  ]);

  const summary = await importer.import([entry({ id: "a" })], { ocrByFileId, officers: [officer()] });

  assert.equal(summary.matched_auto, 1);
  const photo = await repository.findByDriveFileId("a");
  assert.equal(photo?.matchStatus, MatchStatus.AutoMatched);
  assert.equal(photo?.matchedOfficerId, "ภาค1/5");
  assert.equal(photo?.confidence, 100);
});

test("conflict/duplicate outcomes still result in exactly one imported ProfilePhoto row each", async () => {
  const { importer, repository } = makeImporter();
  const a = officer({ officerId: "A", fullName: "สมชาย ใจดี", phone: "081-999-9999" });
  const b = officer({ officerId: "B", fullName: "สมชาย ใจดี", phone: "081-999-9999" });
  const ocrByFileId: OcrTextByFileId = new Map([["tie", { text: "สมชาย ใจดี 081-999-9999", failed: false }]]);

  const summary = await importer.import([entry({ id: "tie" })], { ocrByFileId, officers: [a, b] });

  assert.equal(summary.photos_created, 1);
  assert.equal(summary.match_conflict, 1);
  const photo = await repository.findByDriveFileId("tie");
  assert.equal(photo?.matchStatus, MatchStatus.Conflict);
  assert.equal(photo?.matchedOfficerId, null);
});

test("IDEMPOTENT: re-importing the same entries creates no duplicates", async () => {
  const { importer, repository } = makeImporter();
  const entries = [entry({ id: "a" }), entry({ id: "b" })];

  const first = await importer.import(entries);
  assert.equal(first.photos_created, 2);

  const second = await importer.import(entries);
  assert.equal(second.photos_created, 0);
  assert.equal(second.photos_updated, 2);
  assert.equal(await repository.count(), 2);
});

test("persisted photo carries the derived thumbnail/webView URLs and folder metadata", async () => {
  const { importer, repository } = makeImporter();
  await importer.import([entry({ id: "xyz" })]);

  const photo = await repository.findByDriveFileId("xyz");
  assert.match(photo?.thumbnailUrl ?? "", /thumbnail\?id=xyz/);
  assert.match(photo?.webViewUrl ?? "", /file\/d\/xyz\/view/);
  assert.equal(photo?.folderPath, "Profile รายบุคคล ภาค 1/xyz.jpg");
  assert.equal(photo?.region, "ภาค 1");
});
