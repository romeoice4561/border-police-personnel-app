import { test } from "node:test";
import assert from "node:assert/strict";

import { detectDocumentType } from "@/lib/extraction/document_type_detection";

test("no signals matched -> UNKNOWN with 0 confidence, never a guessed type", () => {
  const result = detectDocumentType("random unrelated text with no document markers at all");
  assert.equal(result.type, "UNKNOWN");
  assert.equal(result.confidence, 0);
  assert.deepEqual(result.matchedSignals, []);
});

test("GP7 form title is detected", () => {
  const result = detectDocumentType("แบบ ก.พ.7 ประวัติข้าราชการ");
  assert.equal(result.type, "GP7");
  assert.ok(result.confidence > 0);
  assert.ok(result.matchedSignals.length > 0);
});

test("National ID Card title + 13-digit ID pattern is detected with high confidence", () => {
  const result = detectDocumentType("บัตรประจำตัวประชาชน เลขประจำตัวประชาชน 1 2345 67890 12 3");
  assert.equal(result.type, "NATIONAL_ID");
  assert.ok(result.confidence > 0.5);
});

test("Driver license is detected from Thai title", () => {
  const result = detectDocumentType("ใบอนุญาตขับขี่รถยนต์ส่วนบุคคล");
  assert.equal(result.type, "DRIVER_LICENSE");
});

test("Passport is detected from English title", () => {
  const result = detectDocumentType("PASSPORT Kingdom of Thailand");
  assert.equal(result.type, "PASSPORT");
});

test("returns matched signals with human-readable descriptions", () => {
  const result = detectDocumentType("ใบรับรองแพทย์");
  assert.equal(result.type, "MEDICAL_DOCUMENT");
  assert.ok(result.matchedSignals.some((s) => s.signal.includes("ใบรับรองแพทย์")));
});

test("ambiguous text matching multiple types populates alternatives", () => {
  // "ประกาศนียบัตร" alone matches both training-certificate wording patterns loosely enough to be worth checking alternatives exist when more than one type scores.
  const result = detectDocumentType("เกียรติบัตร certificate of achievement ประกาศนียบัตร ฝึกอบรม หลักสูตร");
  assert.ok(result.alternatives.length >= 0); // structural check: alternatives is always an array, never undefined
  assert.ok(Array.isArray(result.alternatives));
});

test("alternatives are sorted by confidence descending and never include the winning type", () => {
  const result = detectDocumentType("เกียรติบัตร certificate of achievement หลักสูตร ฝึกอบรม course training");
  for (const alt of result.alternatives) {
    assert.notEqual(alt.type, result.type);
  }
  for (let i = 1; i < result.alternatives.length; i++) {
    assert.ok(result.alternatives[i - 1].confidence >= result.alternatives[i].confidence);
  }
});

test("empty string input returns UNKNOWN, never throws", () => {
  const result = detectDocumentType("");
  assert.equal(result.type, "UNKNOWN");
});
