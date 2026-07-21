import { test } from "node:test";
import assert from "node:assert/strict";

import { DOCUMENT_CANVAS, DOCUMENT_LANDSCAPE_TYPES, isLandscapeDocumentType, DOCUMENT_THUMBNAIL_RENDER_WIDTH } from "@/lib/ui/media_tokens";

/** Converts a Tailwind spacing class (e.g. "w-34") to pixels — Tailwind v4's default scale is N * 0.25rem = N * 4px at the default 16px root. */
function tailwindSpacingToPx(cls: string): number {
  const match = cls.match(/-(\d+(?:\.\d+)?)$/);
  if (!match) throw new Error(`Cannot parse spacing class: ${cls}`);
  return Number(match[1]) * 4;
}

test("Phase 49A.3: LANDSCAPE canvas falls within 150-180 x 100-120 px desktop target", () => {
  const widthPx = tailwindSpacingToPx(DOCUMENT_CANVAS.LANDSCAPE.w);
  const heightPx = tailwindSpacingToPx(DOCUMENT_CANVAS.LANDSCAPE.h);
  assert.ok(widthPx >= 150 && widthPx <= 180, `LANDSCAPE width ${widthPx}px must be within 150-180px`);
  assert.ok(heightPx >= 100 && heightPx <= 120, `LANDSCAPE height ${heightPx}px must be within 100-120px`);
});

test("Phase 49A.3: PORTRAIT canvas falls within 120-140 x 150-180 px desktop target", () => {
  const widthPx = tailwindSpacingToPx(DOCUMENT_CANVAS.PORTRAIT.w);
  const heightPx = tailwindSpacingToPx(DOCUMENT_CANVAS.PORTRAIT.h);
  assert.ok(widthPx >= 120 && widthPx <= 140, `PORTRAIT width ${widthPx}px must be within 120-140px`);
  assert.ok(heightPx >= 150 && heightPx <= 180, `PORTRAIT height ${heightPx}px must be within 150-180px`);
});

test("SQUARE canvas is balanced and HISTORY stays 56x56", () => {
  assert.equal(tailwindSpacingToPx(DOCUMENT_CANVAS.SQUARE.w), 128);
  assert.equal(tailwindSpacingToPx(DOCUMENT_CANVAS.SQUARE.h), 128);
  assert.equal(tailwindSpacingToPx(DOCUMENT_CANVAS.HISTORY.w), 56);
  assert.equal(tailwindSpacingToPx(DOCUMENT_CANVAS.HISTORY.h), 56);
});

test("landscape/portrait document-type classification remains available for pre-load fallback", () => {
  assert.equal(isLandscapeDocumentType("NATIONAL_ID"), true);
  assert.equal(isLandscapeDocumentType("HOUSE_REGISTRATION"), false);
  assert.equal(DOCUMENT_LANDSCAPE_TYPES.has("PASSPORT"), true);
});

test("DOCUMENT_THUMBNAIL_RENDER_WIDTH remains a real positive pixel width", () => {
  assert.ok(DOCUMENT_THUMBNAIL_RENDER_WIDTH > 0);
});

test("canvas frame classes support mobile stacking width + desktop fixed size", () => {
  assert.match(DOCUMENT_CANVAS.PORTRAIT.frame, /w-full/);
  assert.match(DOCUMENT_CANVAS.LANDSCAPE.frame, /w-full/);
  assert.match(DOCUMENT_CANVAS.PORTRAIT.frame, /sm:w-32/);
  assert.match(DOCUMENT_CANVAS.LANDSCAPE.frame, /sm:w-40/);
});
