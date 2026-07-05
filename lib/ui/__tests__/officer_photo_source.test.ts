/**
 * Unit tests for the Phase 18A viewer source resolution (lib/ui/
 * officer_photo_source). Pure — no DOM, no network. Verifies the precedence
 * (high-res from driveFileId → thumbnail fallback), that webViewUrl is exposed
 * as a link (never the <img> src), and the placeholder/no-image case.
 *
 * Run with:
 *   npx tsx --test lib/ui/__tests__/officer_photo_source.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { driveFullImageUrl, resolveViewerSource, FULL_RESOLUTION_WIDTH } from "@/lib/ui/officer_photo_source";

test("driveFullImageUrl derives a high-resolution image URL from a file id", () => {
  assert.equal(driveFullImageUrl("ABC"), `https://drive.google.com/thumbnail?id=ABC&sz=w${FULL_RESOLUTION_WIDTH}`);
  assert.equal(driveFullImageUrl("ABC", 1024), "https://drive.google.com/thumbnail?id=ABC&sz=w1024");
});

test("prefers a high-res image derived from driveFileId, with the stored thumbnail as fallback", () => {
  const s = resolveViewerSource({
    driveFileId: "FILE1",
    thumbnailUrl: "https://drive.google.com/thumbnail?id=FILE1&sz=w256",
    webViewUrl: "https://drive.google.com/file/d/FILE1/view",
  });
  assert.match(s.imageUrl ?? "", /sz=w2048/); // high-res primary
  assert.equal(s.fallbackUrl, "https://drive.google.com/thumbnail?id=FILE1&sz=w256"); // stored thumb fallback
  assert.equal(s.webViewUrl, "https://drive.google.com/file/d/FILE1/view"); // link, not img src
  assert.equal(s.hasImage, true);
});

test("webViewUrl is never used as the image source (it is an HTML page)", () => {
  const s = resolveViewerSource({ webViewUrl: "https://drive.google.com/file/d/X/view" });
  assert.equal(s.imageUrl, null); // no id, no thumbnail → no image
  assert.equal(s.hasImage, false);
  assert.equal(s.webViewUrl, "https://drive.google.com/file/d/X/view"); // still offered as a link
});

test("falls back to the stored thumbnail when there is no driveFileId", () => {
  const s = resolveViewerSource({ thumbnailUrl: "https://drive.google.com/thumbnail?id=Y&sz=w256" });
  assert.equal(s.imageUrl, "https://drive.google.com/thumbnail?id=Y&sz=w256");
  assert.equal(s.fallbackUrl, null); // already on the thumbnail; no further image fallback
  assert.equal(s.hasImage, true);
});

test("no driveFileId, no thumbnail, no webView → placeholder (no image)", () => {
  const s = resolveViewerSource({});
  assert.equal(s.imageUrl, null);
  assert.equal(s.fallbackUrl, null);
  assert.equal(s.webViewUrl, null);
  assert.equal(s.hasImage, false);
});

test("blank/whitespace fields are treated as absent", () => {
  const s = resolveViewerSource({ driveFileId: "  ", thumbnailUrl: "", webViewUrl: null });
  assert.equal(s.hasImage, false);
});

test("no duplicate fallback when the derived high-res URL equals the stored thumbnail", () => {
  // If the stored thumbnail happens to already be the 2048 URL, there is no
  // distinct fallback to set.
  const url = driveFullImageUrl("Z");
  const s = resolveViewerSource({ driveFileId: "Z", thumbnailUrl: url });
  assert.equal(s.imageUrl, url);
  assert.equal(s.fallbackUrl, null);
});
