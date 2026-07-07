/**
 * Unit tests for the Phase 21B-2 dry-run scoring logic (profile_relink_matcher).
 * Pure — no DB, no OCR engine, no Drive. Verifies the multi-signal scoring and
 * the five-bucket classification (safe match / needs review / duplicate /
 * unknown / conflict).
 *
 * Run with:
 *   npx tsx --test lib/import/__tests__/profile_relink_matcher.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  scoreOfficerAgainstProfileImage,
  classifyCandidates,
  flagDuplicateCandidates,
  type OfficerSignals,
  type ProfileImageSignals,
  type ProfileImageClassification,
} from "@/lib/import/profile_relink_matcher";

function officer(ov: Partial<OfficerSignals> = {}): OfficerSignals {
  return {
    officerId: "ภาค1/5",
    fullName: "อนิรุทธิ์ ขาวจันทร์คง",
    rank: "ร.ต.ท.",
    currentUnit: "ตชด.447",
    region: "ภาค1",
    phone: "081-540-7336",
    timelineUnits: ["กก.ตชด.44"],
    extraPhones: [],
    ...ov,
  };
}

function image(ov: Partial<ProfileImageSignals> = {}): ProfileImageSignals {
  return {
    fileId: "abc123",
    filename: "38.png",
    driveFolder: "Profile รายบุคคล ภาค 1",
    ocrText: "",
    ...ov,
  };
}

test("full name + rank + unit + phone all present scores a safe match (>= 98)", () => {
  const o = officer();
  const img = image({
    ocrText: "ร.ต.ท. อนิรุทธิ์ ขาวจันทร์คง ตชด.447 โทร 081-540-7336",
  });
  const score = scoreOfficerAgainstProfileImage(o, img);
  assert.ok(score.confidence >= 98, `expected >=98, got ${score.confidence}`);
  assert.ok(score.matches.some((m) => m.signal === "fullName"));
  assert.ok(score.matches.some((m) => m.signal === "rank"));
  assert.ok(score.matches.some((m) => m.signal === "unit"));
  assert.ok(score.matches.some((m) => m.signal === "phone"));
});

test("name only (no rank/unit/phone) scores below the needs-review threshold on its own", () => {
  const o = officer();
  const img = image({ ocrText: "อนิรุทธิ์ ขาวจันทร์คง" });
  const score = scoreOfficerAgainstProfileImage(o, img);
  assert.equal(score.confidence, 55); // name alone is a signal, but not enough by itself to clear 80
});

test("region alone (no other signal) never contributes points — too weak/shared to matter standalone", () => {
  const o = officer({ fullName: "", rank: null, currentUnit: null, timelineUnits: [] });
  const img = image({ ocrText: "ภาค1" });
  const score = scoreOfficerAgainstProfileImage(o, img);
  assert.equal(score.confidence, 0);
  assert.deepEqual(score.matches, []);
});

test("region DOES contribute points once another signal has already matched", () => {
  const o = officer({ rank: null, currentUnit: null, timelineUnits: [] });
  const img = image({ ocrText: "อนิรุทธิ์ ขาวจันทร์คง ภาค1" });
  const score = scoreOfficerAgainstProfileImage(o, img);
  assert.ok(score.matches.some((m) => m.signal === "region"));
  assert.equal(score.confidence, 55 + 5);
});

test("no matching signals at all scores 0", () => {
  const o = officer();
  const img = image({ ocrText: "ไม่มีข้อมูลที่เกี่ยวข้องเลย" });
  const score = scoreOfficerAgainstProfileImage(o, img);
  assert.equal(score.confidence, 0);
  assert.deepEqual(score.matches, []);
});

test("phone match uses digit-only comparison (tolerant of OCR spacing)", () => {
  const o = officer({ fullName: "", rank: null, currentUnit: null, region: null, timelineUnits: [] });
  const img = image({ ocrText: "0815407336" });
  const score = scoreOfficerAgainstProfileImage(o, img);
  assert.equal(score.confidence, 25);
  assert.equal(score.matches[0].signal, "phone");
});

test("classifyCandidates: single strong candidate => safe_match", () => {
  const top = { officerId: "A", fullName: "A Name", confidence: 100, matches: [] };
  const result = classifyCandidates(image(), [top]);
  assert.equal(result.classification, "safe_match");
});

test("classifyCandidates: single mid-confidence candidate => needs_review", () => {
  const top = { officerId: "A", fullName: "A Name", confidence: 85, matches: [] };
  const result = classifyCandidates(image(), [top]);
  assert.equal(result.classification, "needs_review");
});

test("classifyCandidates: no candidate above threshold => unknown_officer", () => {
  const weak = { officerId: "A", fullName: "A Name", confidence: 30, matches: [] };
  const result = classifyCandidates(image(), [weak]);
  assert.equal(result.classification, "unknown_officer");
});

test("classifyCandidates: no candidates at all => unknown_officer", () => {
  const result = classifyCandidates(image(), []);
  assert.equal(result.classification, "unknown_officer");
});

test("classifyCandidates: two close high-confidence candidates => conflict", () => {
  const a = { officerId: "A", fullName: "A Name", confidence: 90, matches: [] };
  const b = { officerId: "B", fullName: "B Name", confidence: 85, matches: [] };
  const result = classifyCandidates(image(), [a, b]);
  assert.equal(result.classification, "conflict");
});

test("classifyCandidates: clear winner with a distant runner-up is NOT a conflict", () => {
  const a = { officerId: "A", fullName: "A Name", confidence: 99, matches: [] };
  const b = { officerId: "B", fullName: "B Name", confidence: 40, matches: [] };
  const result = classifyCandidates(image(), [a, b]);
  assert.equal(result.classification, "safe_match");
});

test("flagDuplicateCandidates: two images both top-matching the same officer => the lower one becomes duplicate_candidate", () => {
  const sharedTop = (conf: number) => ({ officerId: "ภาค1/5", fullName: "Same Officer", confidence: conf, matches: [] });

  const classifications: ProfileImageClassification[] = [
    { fileId: "img1", filename: "1.jpg", driveFolder: "Profile ภาค 1", classification: "safe_match", candidates: [sharedTop(99)], explanation: "x" },
    { fileId: "img2", filename: "2.jpg", driveFolder: "Profile ภาค 1", classification: "safe_match", candidates: [sharedTop(95)], explanation: "y" },
  ];

  const result = flagDuplicateCandidates(classifications);
  const byId = Object.fromEntries(result.map((r) => [r.fileId, r.classification]));
  assert.equal(byId.img1, "safe_match"); // highest-confidence keeps its classification
  assert.equal(byId.img2, "duplicate_candidate");
});

test("flagDuplicateCandidates: unrelated top matches are left untouched", () => {
  const classifications: ProfileImageClassification[] = [
    { fileId: "img1", filename: "1.jpg", driveFolder: "f", classification: "safe_match", candidates: [{ officerId: "A", fullName: "A", confidence: 99, matches: [] }], explanation: "x" },
    { fileId: "img2", filename: "2.jpg", driveFolder: "f", classification: "safe_match", candidates: [{ officerId: "B", fullName: "B", confidence: 99, matches: [] }], explanation: "y" },
  ];
  const result = flagDuplicateCandidates(classifications);
  assert.equal(result[0].classification, "safe_match");
  assert.equal(result[1].classification, "safe_match");
});

test("flagDuplicateCandidates: conflicts/unknowns are never reclassified as duplicate", () => {
  const classifications: ProfileImageClassification[] = [
    { fileId: "img1", filename: "1.jpg", driveFolder: "f", classification: "conflict", candidates: [{ officerId: "A", fullName: "A", confidence: 90, matches: [] }], explanation: "x" },
    { fileId: "img2", filename: "2.jpg", driveFolder: "f", classification: "conflict", candidates: [{ officerId: "A", fullName: "A", confidence: 88, matches: [] }], explanation: "y" },
  ];
  const result = flagDuplicateCandidates(classifications);
  assert.equal(result[0].classification, "conflict");
  assert.equal(result[1].classification, "conflict");
});
