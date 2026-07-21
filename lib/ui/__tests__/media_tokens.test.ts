import { test } from "node:test";
import assert from "node:assert/strict";

import { DOCUMENT_CANVAS, DOCUMENT_LANDSCAPE_TYPES, isLandscapeDocumentType, DOCUMENT_THUMBNAIL_RENDER_WIDTH } from "@/lib/ui/media_tokens";

/** Converts a Tailwind spacing class (e.g. "w-34") to pixels — Tailwind v4's default scale is N * 0.25rem = N * 4px at the default 16px root. */
function tailwindSpacingToPx(cls: string): number {
  const match = cls.match(/-(\d+(?:\.\d+)?)$/);
  if (!match) throw new Error(`Cannot parse spacing class: ${cls}`);
  return Number(match[1]) * 4;
}

test("Phase 49A.2: LANDSCAPE canvas falls within the requested 120-140 x 88-104 px desktop target", () => {
  const widthPx = tailwindSpacingToPx(DOCUMENT_CANVAS.LANDSCAPE.w);
  const heightPx = tailwindSpacingToPx(DOCUMENT_CANVAS.LANDSCAPE.h);
  assert.ok(widthPx >= 120 && widthPx <= 140, `LANDSCAPE width ${widthPx}px must be within 120-140px`);
  assert.ok(heightPx >= 88 && heightPx <= 104, `LANDSCAPE height ${heightPx}px must be within 88-104px`);
});

test("Phase 49A.2: PORTRAIT canvas is larger than the pre-polish Phase 45A size (96x120), confirming the enlargement actually happened", () => {
  const widthPx = tailwindSpacingToPx(DOCUMENT_CANVAS.PORTRAIT.w);
  const heightPx = tailwindSpacingToPx(DOCUMENT_CANVAS.PORTRAIT.h);
  assert.ok(widthPx > 96, "portrait width must have grown from the Phase 45A 96px baseline");
  assert.ok(heightPx > 120, "portrait height must have grown from the Phase 45A 120px baseline");
});

test("HISTORY (small/row) canvas is unchanged at 56x56 — this phase only touches the main card thumbnail", () => {
  assert.equal(tailwindSpacingToPx(DOCUMENT_CANVAS.HISTORY.w), 56);
  assert.equal(tailwindSpacingToPx(DOCUMENT_CANVAS.HISTORY.h), 56);
});

test("landscape/portrait document-type classification is unchanged by the thumbnail polish", () => {
  assert.equal(isLandscapeDocumentType("NATIONAL_ID"), true);
  assert.equal(isLandscapeDocumentType("HOUSE_REGISTRATION"), false);
  assert.equal(DOCUMENT_LANDSCAPE_TYPES.has("PASSPORT"), true);
});

test("DOCUMENT_THUMBNAIL_RENDER_WIDTH remains a real positive pixel width (unaffected by the canvas-size polish)", () => {
  assert.ok(DOCUMENT_THUMBNAIL_RENDER_WIDTH > 0);
});
