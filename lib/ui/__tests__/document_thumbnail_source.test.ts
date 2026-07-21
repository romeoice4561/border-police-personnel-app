/**
 * Phase 49A.3 — document thumbnail source priority + orientation helpers.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  deriveDocumentThumbnailUrl,
  fallbackOrientationForDocumentType,
  isDocumentWebViewUrl,
  orientationFromNaturalSize,
  resolveDocumentImageSrc,
  upgradeDriveImageUrl,
} from "@/lib/ui/document_thumbnail_source";
import {
  DOCUMENT_CANVAS,
  documentCanvasForOrientation,
  documentThumbnailContentInsetClass,
  documentThumbnailContentScale,
} from "@/lib/ui/media_tokens";

const FULL_SUPABASE =
  "https://example.supabase.co/storage/v1/object/public/officer-documents/pass.jpg";
const TINY_RENDER =
  "https://example.supabase.co/storage/v1/render/image/public/officer-documents/pass.jpg?width=480";
const TINY_DRIVE_THUMB = "https://drive.google.com/thumbnail?id=FILE1&sz=w256";
const WEB_VIEW = "https://drive.google.com/file/d/FILE1/view";

test("full-resolution fileUrl preferred over tiny stored thumbnail", () => {
  const s = resolveDocumentImageSrc({
    fileUrl: FULL_SUPABASE,
    mimeType: "image/jpeg",
    thumbnailUrl: TINY_RENDER,
  });
  assert.equal(s.imageUrl, FULL_SUPABASE);
  assert.equal(s.sourceKind, "full_file");
  assert.equal(s.fallbackUrl, TINY_RENDER);
  assert.equal(s.hasImage, true);
});

test("genuine Drive source uses high-resolution URL", () => {
  const s = resolveDocumentImageSrc({
    driveFileId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
    thumbnailUrl: "https://drive.google.com/thumbnail?id=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms&sz=w256",
    mimeType: "image/jpeg",
  });
  assert.ok(s.imageUrl?.includes("sz=w1280"), "high-res Drive URL required");
  assert.equal(s.sourceKind, "drive_high_res");
  assert.ok(s.fallbackUrl?.includes("sz=w256"));
});

test("synthetic upload source uses persisted uploaded file URL — never fake Drive", () => {
  const s = resolveDocumentImageSrc({
    fileUrl: FULL_SUPABASE,
    mimeType: "image/jpeg",
    driveFileId: "upload:123e4567-e89b-12d3-a456-426614174000",
    thumbnailUrl: TINY_RENDER,
  });
  assert.equal(s.imageUrl, FULL_SUPABASE);
  assert.equal(s.sourceKind, "full_file");
  assert.ok(!s.imageUrl?.includes("drive.google.com"));
});

test("synthetic driveFileId alone without fileUrl does not invent a Drive URL", () => {
  const s = resolveDocumentImageSrc({
    driveFileId: "upload:abc",
    mimeType: "image/jpeg",
    thumbnailUrl: FULL_SUPABASE,
  });
  assert.equal(s.imageUrl, FULL_SUPABASE);
  assert.equal(s.sourceKind, "stored_thumbnail");
  assert.ok(!s.imageUrl?.includes("drive.google.com/thumbnail?id=upload"));
});

test("webView URL never used as image src", () => {
  assert.equal(isDocumentWebViewUrl(WEB_VIEW), true);
  const s = resolveDocumentImageSrc({
    fileUrl: WEB_VIEW,
    mimeType: "image/jpeg",
    webViewUrl: WEB_VIEW,
  });
  assert.equal(s.imageUrl, null);
  assert.equal(s.hasImage, false);
  assert.doesNotMatch(JSON.stringify(s), /\/file\/d\/FILE1\/view/);
});

test("tiny Drive thumbnail URL is upgraded when used as fileUrl", () => {
  assert.match(upgradeDriveImageUrl(TINY_DRIVE_THUMB), /sz=w1280/);
  const s = resolveDocumentImageSrc({
    fileUrl: TINY_DRIVE_THUMB,
    mimeType: "image/jpeg",
  });
  assert.match(s.imageUrl ?? "", /sz=w1280/);
});

test("PDF / non-image → no image src (fallback icon path)", () => {
  const s = resolveDocumentImageSrc({
    fileUrl: "https://example.supabase.co/storage/v1/object/public/officer-documents/x.pdf",
    mimeType: "application/pdf",
  });
  assert.equal(s.imageUrl, null);
  assert.equal(s.hasImage, false);
  assert.equal(s.sourceKind, "none");
});

test("deriveDocumentThumbnailUrl returns full file URL for images (not tiny render)", () => {
  assert.equal(deriveDocumentThumbnailUrl(FULL_SUPABASE, "image/jpeg"), FULL_SUPABASE);
  assert.equal(deriveDocumentThumbnailUrl(FULL_SUPABASE, "application/pdf"), null);
});

test("orientationFromNaturalSize: portrait / landscape / square", () => {
  assert.equal(orientationFromNaturalSize(800, 1200), "portrait");
  assert.equal(orientationFromNaturalSize(1600, 1000), "landscape");
  assert.equal(orientationFromNaturalSize(1000, 1000), "square");
  assert.equal(orientationFromNaturalSize(1000, 1040), "square");
});

test("portrait image receives portrait frame; landscape receives landscape frame", () => {
  const portrait = documentCanvasForOrientation("portrait", "md");
  const landscape = documentCanvasForOrientation("landscape", "md");
  const square = documentCanvasForOrientation("square", "md");
  assert.equal(portrait, DOCUMENT_CANVAS.PORTRAIT);
  assert.equal(landscape, DOCUMENT_CANVAS.LANDSCAPE);
  assert.equal(square, DOCUMENT_CANVAS.SQUARE);
  assert.match(portrait.frame, /h-42|aspect-\[16\/21\]/);
  assert.match(landscape.frame, /h-28|aspect-\[10\/7\]/);
});

test("fallback orientation still uses type registry before load", () => {
  assert.equal(fallbackOrientationForDocumentType("PASSPORT"), "landscape");
  assert.equal(fallbackOrientationForDocumentType("HOUSE_REGISTRATION"), "portrait");
});

test("DocumentThumbnail keeps object-contain, no object-cover on document foreground, one canvas layer", () => {
  const thumbSrc = readFileSync(
    path.join(process.cwd(), "components/ui/media/DocumentThumbnail.tsx"),
    "utf8"
  );
  assert.match(thumbSrc, /object-contain/);
  assert.match(thumbSrc, /data-fit="contain"/);
  assert.match(thumbSrc, /data-preview-canvas="primary"/);
  assert.match(thumbSrc, /resolveDocumentImageSrc/);
  assert.match(thumbSrc, /orientationFromNaturalSize/);
  // Foreground document images must not use object-cover. Decorative backdrop may.
  const foregroundCovers = [...thumbSrc.matchAll(/data-fit="contain"[\s\S]{0,200}object-cover/g)];
  assert.equal(foregroundCovers.length, 0);
  assert.doesNotMatch(thumbSrc, /p-1\.5/);
  // Only one content inset layer token usage pattern for the image box.
  assert.match(thumbSrc, /documentThumbnailContentInsetClass/);

  const portraitSrc = readFileSync(
    path.join(process.cwd(), "components/ui/media/PortraitAvatar.tsx"),
    "utf8"
  );
  assert.match(portraitSrc, /object-cover/);
});

test("content inset remains a single minimal safety margin (96%/92%)", () => {
  assert.equal(documentThumbnailContentScale("md"), 0.96);
  assert.equal(documentThumbnailContentScale("sm"), 0.92);
  assert.equal(documentThumbnailContentInsetClass("md"), "inset-[2%]");
  assert.equal(documentThumbnailContentInsetClass("sm"), "inset-[4%]");
});

test("epf card stacks thumbnail above text on mobile and wires localized preview aria-label", () => {
  const card = readFileSync(
    path.join(process.cwd(), "components/officer/epf/epf_document_card.tsx"),
    "utf8"
  );
  assert.match(card, /flex-col gap-3 sm:flex-row/);
  assert.match(card, /previewAriaLabel=\{`\$\{t\("epf\.cardPreviewThumbnail"\)\} \$\{typeLabel\}`\}/);
  assert.match(card, /onClick=\{doc\?\.fileUrl \? \(\) => openPreview\(doc\.fileUrl\) : undefined\}/);
});
