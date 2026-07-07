/**
 * Unit tests for the Profile Completeness calculator (Phase 21A; Phase 23A
 * extends contact/education/training to real data). Pure — no DB, no React.
 * Verifies the score derives only from persisted fields and that the
 * still-unbacked items (awards/documents/GP7) never mark complete.
 *
 * Run with:
 *   npx tsx --test lib/ui/__tests__/profile_completeness.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { computeProfileCompleteness } from "@/lib/ui/profile_completeness";
import type { OfficerWithRelations } from "@/lib/database/query_types";

function officer(ov: Partial<OfficerWithRelations> = {}): OfficerWithRelations {
  return {
    id: 1,
    officerId: "ภาค1/5",
    rank: "ร.ต.ท.",
    firstName: "อนิรุทธิ์",
    lastName: "ขาวจันทร์คง",
    currentPosition: "ผบ.ร้อย",
    currentUnit: "ตชด.447",
    phone: "081-540-7336",
    careerYears: 19,
    qualityScore: 90,
    knowledgeScore: 80,
    region: "ภาค1",
    confidence: 80,
    thumbnailUrl: null,
    driveFileId: null,
    webViewUrl: null,
    email: null,
    lineId: null,
    facebookUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    timeline: [{ id: 1, officerId: 1, sequence: 0, year: "2564", yearValue: 2564, position: "ผบ.ร้อย", unit: "ตชด.447" }],
    phones: [{ id: 1, officerId: 1, number: "081-540-7336" }],
    education: [],
    training: [],
    ...ov,
  } as OfficerWithRelations;
}

test("a fully-populated officer (minus still-unbacked items) checks exactly the 5 backed items", () => {
  const result = computeProfileCompleteness(officer({ thumbnailUrl: "https://drive.google.com/thumbnail?id=x" }));
  const completeIds = result.items.filter((i) => i.complete).map((i) => i.id);
  // Phase 23A: contactInformation is now real (phone is set in the fixture) —
  // so this officer clears 5 of 10 items, not 4.
  assert.deepEqual(
    completeIds.sort(),
    ["basicInformation", "careerTimeline", "contactInformation", "currentPosition", "officialPortrait"].sort()
  );
  assert.equal(result.percent, 50); // 5 of 10 items
});

test("still-unbacked items (awards/documents/gp7) are never marked complete", () => {
  const result = computeProfileCompleteness(officer({ thumbnailUrl: "https://x" }));
  const stillUnbacked = ["awards", "documents", "gp7"];
  for (const id of stillUnbacked) {
    const item = result.items.find((i) => i.id === id);
    assert.equal(item?.complete, false, `${id} should never be complete yet`);
  }
});

test("contactInformation is complete when ANY contact channel is present, false when all are blank", () => {
  const withEmailOnly = computeProfileCompleteness(officer({ phone: null, email: "a@b.com" }));
  assert.equal(withEmailOnly.items.find((i) => i.id === "contactInformation")?.complete, true);

  const withNoContact = computeProfileCompleteness(officer({ phone: null, email: null, lineId: null, facebookUrl: null }));
  assert.equal(withNoContact.items.find((i) => i.id === "contactInformation")?.complete, false);
});

test("education/trainingCourses are complete only when rows exist", () => {
  const withRows = computeProfileCompleteness(
    officer({
      education: [{ id: 1, officerId: 1, year: null, institution: "x", degree: null, notes: null, createdAt: new Date(), updatedAt: new Date() }],
      training: [{ id: 1, officerId: 1, year: null, course: "x", organization: null, notes: null, createdAt: new Date(), updatedAt: new Date() }],
    })
  );
  assert.equal(withRows.items.find((i) => i.id === "education")?.complete, true);
  assert.equal(withRows.items.find((i) => i.id === "trainingCourses")?.complete, true);

  const withoutRows = computeProfileCompleteness(officer());
  assert.equal(withoutRows.items.find((i) => i.id === "education")?.complete, false);
  assert.equal(withoutRows.items.find((i) => i.id === "trainingCourses")?.complete, false);
});

test("missing rank/name fails basicInformation; missing position/unit fails currentPosition", () => {
  const missingBasic = computeProfileCompleteness(officer({ rank: "" }));
  assert.equal(missingBasic.items.find((i) => i.id === "basicInformation")?.complete, false);

  const missingPosition = computeProfileCompleteness(officer({ currentPosition: null }));
  assert.equal(missingPosition.items.find((i) => i.id === "currentPosition")?.complete, false);
});

test("empty timeline fails careerTimeline", () => {
  const result = computeProfileCompleteness(officer({ timeline: [] }));
  assert.equal(result.items.find((i) => i.id === "careerTimeline")?.complete, false);
});

test("no thumbnailUrl fails officialPortrait (extracted-photo fallback signal)", () => {
  const result = computeProfileCompleteness(officer({ thumbnailUrl: null }));
  assert.equal(result.items.find((i) => i.id === "officialPortrait")?.complete, false);
});

test("a minimal/incomplete officer scores low and lists all gaps", () => {
  const result = computeProfileCompleteness(
    officer({
      rank: "",
      currentPosition: null,
      currentUnit: null,
      timeline: [],
      thumbnailUrl: null,
      phone: null,
      phones: [],
    })
  );
  assert.equal(result.percent, 0);
  assert.ok(result.items.every((i) => i.complete === false));
});

test("percent is always an integer between 0 and 100", () => {
  const result = computeProfileCompleteness(officer());
  assert.ok(Number.isInteger(result.percent));
  assert.ok(result.percent >= 0 && result.percent <= 100);
});
