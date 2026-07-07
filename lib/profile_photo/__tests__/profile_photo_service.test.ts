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
import { MatchStatus, OcrStatus, type ProfilePhotoInput } from "@/lib/profile_photo/profile_photo_types";

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
