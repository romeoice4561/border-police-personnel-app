/**
 * Unit tests for portrait validation + image-dimension probing (Phase 24B-1).
 *
 * Run with:
 *   npx tsx --test lib/portrait/__tests__/portrait_validation.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  validatePortrait,
  readImageDimensions,
  MAX_PORTRAIT_BYTES,
} from "@/lib/portrait/portrait_validation";

test("accepts jpg/jpeg/png/webp within the size limit", () => {
  for (const mimeType of ["image/jpeg", "image/jpg", "image/png", "image/webp"]) {
    const r = validatePortrait({ mimeType, byteLength: 1024 });
    assert.equal(r.ok, true);
  }
});

test("rejects an unsupported type", () => {
  const r = validatePortrait({ mimeType: "image/gif", byteLength: 1024 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "UNSUPPORTED_TYPE");
});

test("rejects a file over 5 MB", () => {
  const r = validatePortrait({ mimeType: "image/png", byteLength: MAX_PORTRAIT_BYTES + 1 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "TOO_LARGE");
});

test("rejects an empty file", () => {
  const r = validatePortrait({ mimeType: "image/png", byteLength: 0 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "EMPTY");
});

test("case-insensitive mime type is accepted and maps to an extension", () => {
  const r = validatePortrait({ mimeType: "IMAGE/JPEG", byteLength: 10 });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.extension, "jpg");
});

test("reads PNG dimensions from the IHDR header", () => {
  // 8-byte signature + IHDR length/type + width(4) + height(4).
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 800);
  view.setUint32(20, 600);
  assert.deepEqual(readImageDimensions(bytes), { width: 800, height: 600 });
});

test("reads JPEG dimensions from an SOF0 marker", () => {
  // FFD8 (SOI) then FFC0 (SOF0): len(2)=0x0011, precision(1), height(2), width(2)...
  const bytes = new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xc0, // SOF0
    0x00, 0x11, // length
    0x08, // precision
    0x01, 0x90, // height = 400
    0x02, 0x8a, // width = 650
    0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // components padding
  ]);
  assert.deepEqual(readImageDimensions(bytes), { width: 650, height: 400 });
});

test("returns null for an unparseable header", () => {
  assert.equal(readImageDimensions(new Uint8Array([1, 2, 3, 4])), null);
});
