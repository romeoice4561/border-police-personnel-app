/**
 * Unit tests for Drive photo URL derivation (Phase 17B). Pure — no Drive API,
 * no network. Verifies deterministic thumbnail/webView URLs from a file id,
 * captured-link precedence, and the all-null case.
 *
 * Run with:
 *   npx tsx --test lib/google-drive/__tests__/drive_photo_url.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildOfficerPhoto,
  driveThumbnailUrl,
  driveWebViewUrl,
  emptyOfficerPhoto,
  photoFromDriveMetadata,
} from "@/lib/google-drive/drive_photo_url";
import type { DriveFileMetadata } from "@/lib/google-drive/drive_types";

test("driveThumbnailUrl derives a sized thumbnail URL from a file id", () => {
  assert.equal(driveThumbnailUrl("ABC123", 256), "https://drive.google.com/thumbnail?id=ABC123&sz=w256");
});

test("driveWebViewUrl derives the view URL from a file id", () => {
  assert.equal(driveWebViewUrl("ABC123"), "https://drive.google.com/file/d/ABC123/view");
});

test("buildOfficerPhoto derives both URLs from just a file id", () => {
  const photo = buildOfficerPhoto({ driveFileId: "FILE1" });
  assert.equal(photo.driveFileId, "FILE1");
  assert.match(photo.thumbnailUrl ?? "", /thumbnail\?id=FILE1/);
  assert.match(photo.webViewUrl ?? "", /file\/d\/FILE1\/view/);
});

test("buildOfficerPhoto prefers captured provider links over derived ones", () => {
  const photo = buildOfficerPhoto({
    driveFileId: "FILE1",
    thumbnailLink: "https://lh3.googleusercontent.com/captured-thumb",
    webViewLink: "https://drive.google.com/captured-view",
  });
  assert.equal(photo.thumbnailUrl, "https://lh3.googleusercontent.com/captured-thumb");
  assert.equal(photo.webViewUrl, "https://drive.google.com/captured-view");
});

test("buildOfficerPhoto returns all-null when nothing is available (→ placeholder)", () => {
  assert.deepEqual(buildOfficerPhoto({}), { driveFileId: null, thumbnailUrl: null, webViewUrl: null });
  assert.deepEqual(buildOfficerPhoto({ driveFileId: "  " }), { driveFileId: null, thumbnailUrl: null, webViewUrl: null });
});

test("a captured thumbnailLink with no file id still yields a usable thumbnail", () => {
  const photo = buildOfficerPhoto({ thumbnailLink: "https://lh3.googleusercontent.com/x" });
  assert.equal(photo.driveFileId, null);
  assert.equal(photo.thumbnailUrl, "https://lh3.googleusercontent.com/x");
  assert.equal(photo.webViewUrl, null);
});

test("photoFromDriveMetadata reuses the captured metadata links", () => {
  const file: DriveFileMetadata = {
    id: "DRIVE9",
    name: "officer.jpg",
    mimeType: "image/jpeg",
    size: "1024",
    modifiedTime: "2026-01-01T00:00:00Z",
    parents: [],
    thumbnailLink: "https://lh3.googleusercontent.com/meta-thumb",
    webViewLink: "https://drive.google.com/meta-view",
  };
  const photo = photoFromDriveMetadata(file);
  assert.equal(photo.driveFileId, "DRIVE9");
  assert.equal(photo.thumbnailUrl, "https://lh3.googleusercontent.com/meta-thumb");
  assert.equal(photo.webViewUrl, "https://drive.google.com/meta-view");
});

test("emptyOfficerPhoto is all-null", () => {
  assert.deepEqual(emptyOfficerPhoto(), { driveFileId: null, thumbnailUrl: null, webViewUrl: null });
});

test("file ids are URL-encoded in derived URLs", () => {
  const photo = buildOfficerPhoto({ driveFileId: "a b/c" });
  assert.match(photo.thumbnailUrl ?? "", /id=a%20b%2Fc/);
});
