import { test } from "node:test";
import assert from "node:assert/strict";

import { maskNationalId, safeTextPreview, redactSensitiveFields } from "@/lib/extraction/redaction";

test("maskNationalId masks all but the last 4 digits", () => {
  assert.equal(maskNationalId("1101200254896"), "xxxxxxxxx4896");
});

test("maskNationalId strips separators before masking", () => {
  assert.equal(maskNationalId("1-1012-00254-89-6"), "xxxxxxxxx4896");
});

test("maskNationalId never reveals more than 4 real digits, regardless of input format", () => {
  const masked = maskNationalId("1101200254896");
  const revealedDigits = masked.replace(/x/g, "");
  assert.equal(revealedDigits.length, 4);
});

test("safeTextPreview never returns the full text when it exceeds the preview length", () => {
  const longText = "a".repeat(1000);
  const preview = safeTextPreview(longText, 20);
  assert.equal(preview.length, 1000);
  assert.ok(preview.preview.length <= 21); // 20 chars + ellipsis marker
  assert.notEqual(preview.preview, longText);
});

test("safeTextPreview returns the full text as the preview when it's shorter than the limit", () => {
  const preview = safeTextPreview("short", 20);
  assert.equal(preview.preview, "short");
});

test("redactSensitiveFields masks a nationalId-keyed field value", () => {
  const fields = { nationalId: "1101200254896", name: "สมชาย" };
  const redacted = redactSensitiveFields(fields);
  assert.equal(redacted.nationalId, "xxxxxxxxx4896");
  assert.equal(redacted.name, "สมชาย"); // non-sensitive fields untouched
});

test("redactSensitiveFields is case-insensitive on the field key", () => {
  const fields = { NationalID: "1101200254896" };
  const redacted = redactSensitiveFields(fields);
  assert.equal(redacted.NationalID, "xxxxxxxxx4896");
});

test("redactSensitiveFields does not mutate the original object", () => {
  const fields = { nationalId: "1101200254896" };
  const redacted = redactSensitiveFields(fields);
  assert.notEqual(redacted, fields);
  assert.equal(fields.nationalId, "1101200254896"); // original untouched
});
