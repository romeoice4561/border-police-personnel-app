/**
 * Unit tests for document validation (Phase 29A — Officer Document Vault Foundation).
 *
 * Run with:
 *   npx tsx --test lib/document/__tests__/document_validation.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  validateDocument,
  MAX_DOCUMENT_BYTES,
  ALLOWED_DOCUMENT_MIME,
} from "@/lib/document/document_validation";

test("accepts a valid JPG", () => {
  const result = validateDocument({ mimeType: "image/jpeg", byteLength: 1024 });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.extension, "jpg");
});

test("accepts a valid PNG", () => {
  const result = validateDocument({ mimeType: "image/png", byteLength: 2048 });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.extension, "png");
});

test("accepts a valid WEBP", () => {
  const result = validateDocument({ mimeType: "image/webp", byteLength: 512 });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.extension, "webp");
});

test("accepts a valid PDF", () => {
  const result = validateDocument({ mimeType: "application/pdf", byteLength: 50000 });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.extension, "pdf");
});

test("rejects an empty file", () => {
  const result = validateDocument({ mimeType: "application/pdf", byteLength: 0 });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "EMPTY");
});

test("rejects an unsupported MIME type", () => {
  const result = validateDocument({ mimeType: "image/gif", byteLength: 1024 });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "UNSUPPORTED_TYPE");
});

test("rejects a file that exceeds MAX_DOCUMENT_BYTES", () => {
  const result = validateDocument({ mimeType: "application/pdf", byteLength: MAX_DOCUMENT_BYTES + 1 });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "TOO_LARGE");
});

test("accepts a file exactly at MAX_DOCUMENT_BYTES", () => {
  const result = validateDocument({ mimeType: "application/pdf", byteLength: MAX_DOCUMENT_BYTES });
  assert.equal(result.ok, true);
});

test("ALLOWED_DOCUMENT_MIME includes pdf", () => {
  assert.ok("application/pdf" in ALLOWED_DOCUMENT_MIME);
  assert.equal(ALLOWED_DOCUMENT_MIME["application/pdf"], "pdf");
});

test("ALLOWED_DOCUMENT_MIME includes image types", () => {
  assert.ok("image/jpeg" in ALLOWED_DOCUMENT_MIME);
  assert.ok("image/png" in ALLOWED_DOCUMENT_MIME);
  assert.ok("image/webp" in ALLOWED_DOCUMENT_MIME);
});

test("case-insensitive MIME matching", () => {
  const result = validateDocument({ mimeType: "APPLICATION/PDF", byteLength: 1024 });
  // The validation normalises to lowercase, so APPLICATION/PDF should be accepted.
  // Current impl: input.mimeType.toLowerCase() → this works.
  assert.equal(result.ok, true);
});
