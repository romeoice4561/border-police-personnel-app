/**
 * Unit tests for the Phase 24B-2 portrait history / "Set as Current" API
 * handlers, over a real ProfilePhotoService backed by the in-memory
 * repository — no running server, no live DB.
 *
 * Run with:
 *   npx tsx --test lib/portrait/__tests__/portrait_history_api.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryProfilePhotoRepository } from "@/lib/profile_photo/profile_photo_repository";
import { ProfilePhotoService } from "@/lib/profile_photo/profile_photo_service";
import { MatchStatus, OcrStatus, PortraitClassification, type ProfilePhotoInput } from "@/lib/profile_photo/profile_photo_types";
import { handlePortraitHistory, handleSetCurrentPortrait } from "@/lib/portrait/portrait_api_handlers";

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
    ...ov,
  };
}

function service() {
  return new ProfilePhotoService({ repository: new InMemoryProfilePhotoRepository() });
}

test("GET history returns 200 with every photo for the officer", async () => {
  const svc = service();
  await svc.ingest([
    photo({ driveFileId: "a", matchedOfficerId: "ภาค1/5" }),
    photo({ driveFileId: "b", matchedOfficerId: "ภาค1/5", isProfile: true }),
    photo({ driveFileId: "c", matchedOfficerId: "other" }),
  ]);

  const res = await handlePortraitHistory(svc, "ภาค1/5");
  assert.equal(res.status, 200);
  const json = (await res.json()) as { data: unknown[] };
  assert.equal(json.data.length, 2);
});

test("GET history returns 400 for an invalid officer id", async () => {
  const res = await handlePortraitHistory(service(), "   ");
  assert.equal(res.status, 400);
});

test("POST set-current promotes an existing photo and returns 200", async () => {
  const svc = service();
  await svc.ingest([
    photo({ driveFileId: "old", matchedOfficerId: "ภาค1/5", isProfile: true }),
    photo({ driveFileId: "candidate", matchedOfficerId: "ภาค1/5", isProfile: false }),
  ]);
  const candidate = await svc.getByDriveFileId("candidate");

  const res = await handleSetCurrentPortrait(svc, "ภาค1/5", String(candidate!.id));
  assert.equal(res.status, 200);
  const json = (await res.json()) as { data: { isProfile: boolean } };
  assert.equal(json.data.isProfile, true);
});

test("POST set-current returns 404 for a photo id that isn't linked to this officer", async () => {
  const svc = service();
  await svc.ingest([photo({ driveFileId: "a", matchedOfficerId: "someone-else" })]);
  const row = await svc.getByDriveFileId("a");

  const res = await handleSetCurrentPortrait(svc, "ภาค1/5", String(row!.id));
  assert.equal(res.status, 404);
});

test("POST set-current returns 400 for a non-numeric photo id", async () => {
  const res = await handleSetCurrentPortrait(service(), "ภาค1/5", "not-a-number");
  assert.equal(res.status, 400);
});
