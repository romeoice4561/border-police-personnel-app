/**
 * Unit tests for the Phase 24B-2 legacy-cleanup API handlers (list, counts,
 * classify, bulk-classify), over a real ProfilePhotoService backed by the
 * in-memory repository — no running server, no live DB.
 *
 * Run with:
 *   npx tsx --test lib/profile_photo/__tests__/profile_photo_api_handlers.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryProfilePhotoRepository } from "@/lib/profile_photo/profile_photo_repository";
import { ProfilePhotoService } from "@/lib/profile_photo/profile_photo_service";
import { MatchStatus, OcrStatus, PortraitClassification, PhotoType, type ProfilePhotoInput } from "@/lib/profile_photo/profile_photo_types";
import {
  handleListProfilePhotos,
  handleClassificationCounts,
  handleClassifyProfilePhoto,
  handleBulkClassifyProfilePhotos,
} from "@/lib/profile_photo/profile_photo_api_handlers";

function photo(ov: Partial<ProfilePhotoInput> = {}): ProfilePhotoInput {
  return {
    driveFileId: "file-1",
    thumbnailUrl: null,
    webViewUrl: null,
    filename: "38.png",
    folderPath: "Profile รายบุคคล ภาค 1/38.png",
    region: null,
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
    photoType: PhotoType.GoogleProfileCard,
    ...ov,
  };
}

function service() {
  return new ProfilePhotoService({ repository: new InMemoryProfilePhotoRepository() });
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/profile-photos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("GET list returns 200, filtered by classification", async () => {
  const svc = service();
  await svc.ingest([
    photo({ driveFileId: "a", classification: PortraitClassification.Map }),
    photo({ driveFileId: "b", classification: PortraitClassification.Unknown }),
  ]);

  const url = new URL("http://localhost/api/profile-photos?classification=MAP");
  const res = await handleListProfilePhotos(svc, url);
  assert.equal(res.status, 200);
  const json = (await res.json()) as { data: Array<{ driveFileId: string }>; meta: { total: number } };
  assert.equal(json.meta.total, 1);
  assert.equal(json.data[0].driveFileId, "a");
});

test("GET list returns 400 for an invalid classification value", async () => {
  const url = new URL("http://localhost/api/profile-photos?classification=NOT_REAL");
  const res = await handleListProfilePhotos(service(), url);
  assert.equal(res.status, 400);
});

test("GET list searches by officer id and by Drive file id", async () => {
  const svc = service();
  await svc.ingest([
    photo({ driveFileId: "drive-abc", matchedOfficerId: "ภาค1/5" }),
    photo({ driveFileId: "other" }),
  ]);

  const byOfficer = await handleListProfilePhotos(svc, new URL("http://localhost/x?search=ภาค1/5"));
  assert.equal(((await byOfficer.json()) as { meta: { total: number } }).meta.total, 1);

  const byDriveId = await handleListProfilePhotos(svc, new URL("http://localhost/x?search=drive-abc"));
  assert.equal(((await byDriveId.json()) as { meta: { total: number } }).meta.total, 1);
});

test("GET counts returns every classification value", async () => {
  const svc = service();
  await svc.ingest([photo({ driveFileId: "a", classification: PortraitClassification.RealPerson })]);
  const res = await handleClassificationCounts(svc);
  assert.equal(res.status, 200);
  const json = (await res.json()) as { data: Array<{ classification: string; count: number }> };
  assert.equal(json.data.length, Object.values(PortraitClassification).length);
});

test("POST classify updates one photo and returns 200", async () => {
  const svc = service();
  await svc.ingest([photo({ driveFileId: "a" })]);
  const row = await svc.getByDriveFileId("a");

  const res = await handleClassifyProfilePhoto(
    svc,
    String(row!.id),
    jsonRequest({ classification: "ORGANIZATION", classifiedBy: "reviewer-1" })
  );
  assert.equal(res.status, 200);
  const json = (await res.json()) as { data: { classification: string } };
  assert.equal(json.data.classification, "ORGANIZATION");
});

test("POST classify returns 404 for an unknown photo id", async () => {
  const res = await handleClassifyProfilePhoto(service(), "999999", jsonRequest({ classification: "MAP" }));
  assert.equal(res.status, 404);
});

test("POST classify returns 400 for an invalid classification value", async () => {
  const svc = service();
  await svc.ingest([photo({ driveFileId: "a" })]);
  const row = await svc.getByDriveFileId("a");
  const res = await handleClassifyProfilePhoto(svc, String(row!.id), jsonRequest({ classification: "NOT_REAL" }));
  assert.equal(res.status, 400);
});

test("POST bulk-classify updates every requested id and reports the count", async () => {
  const svc = service();
  await svc.ingest([photo({ driveFileId: "a" }), photo({ driveFileId: "b" }), photo({ driveFileId: "c" })]);
  const a = await svc.getByDriveFileId("a");
  const b = await svc.getByDriveFileId("b");

  const res = await handleBulkClassifyProfilePhotos(
    svc,
    jsonRequest({ ids: [a!.id, b!.id], classification: "REAL_PERSON" })
  );
  assert.equal(res.status, 200);
  const json = (await res.json()) as { data: { requested: number; updated: number } };
  assert.equal(json.data.requested, 2);
  assert.equal(json.data.updated, 2);

  assert.equal((await svc.getByDriveFileId("a"))?.classification, PortraitClassification.RealPerson);
  assert.equal((await svc.getByDriveFileId("c"))?.classification, PortraitClassification.Unknown, "untouched id stays as-is");
});

test("POST bulk-classify skips missing ids without failing the whole batch", async () => {
  const svc = service();
  await svc.ingest([photo({ driveFileId: "a" })]);
  const a = await svc.getByDriveFileId("a");

  const res = await handleBulkClassifyProfilePhotos(svc, jsonRequest({ ids: [a!.id, 999999], classification: "MAP" }));
  assert.equal(res.status, 200);
  const json = (await res.json()) as { data: { requested: number; updated: number } };
  assert.equal(json.data.requested, 2);
  assert.equal(json.data.updated, 1);
});

test("POST bulk-classify returns 400 for an empty ids array", async () => {
  const res = await handleBulkClassifyProfilePhotos(service(), jsonRequest({ ids: [], classification: "MAP" }));
  assert.equal(res.status, 400);
});
