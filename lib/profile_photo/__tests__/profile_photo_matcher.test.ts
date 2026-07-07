/**
 * Unit tests for ProfilePhotoMatcher (Phase 21C, Part 5) — verifies the
 * mapping from the Phase 21B-2 dry-run classification buckets onto the
 * MatchStatus enum, and that only AUTO_MATCHED ever carries an officer link.
 *
 * Run with:
 *   npx tsx --test lib/profile_photo/__tests__/profile_photo_matcher.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { decideMatchForPhoto, decideMatchesForPhotos, type OfficerSignals, type ProfileImageSignals } from "@/lib/profile_photo/profile_photo_matcher";
import { MatchStatus } from "@/lib/profile_photo/profile_photo_types";

function officer(ov: Partial<OfficerSignals> = {}): OfficerSignals {
  return {
    officerId: "ภาค1/5",
    fullName: "อนิรุทธิ์ ขาวจันทร์คง",
    rank: "ร.ต.ท.",
    currentUnit: "ตชด.447",
    region: "ภาค1",
    phone: "081-540-7336",
    timelineUnits: [],
    extraPhones: [],
    ...ov,
  };
}

function image(ov: Partial<ProfileImageSignals> = {}): ProfileImageSignals {
  return { fileId: "f1", filename: "38.png", driveFolder: "Profile รายบุคคล ภาค 1", ocrText: "", ...ov };
}

test("a clear high-confidence match -> AUTO_MATCHED with matchedOfficerId + confidence set", () => {
  const result = decideMatchForPhoto(
    [officer()],
    image({ ocrText: "ร.ต.ท. อนิรุทธิ์ ขาวจันทร์คง ตชด.447 081-540-7336" })
  );
  assert.equal(result.matchStatus, MatchStatus.AutoMatched);
  assert.equal(result.matchedOfficerId, "ภาค1/5");
  assert.equal(result.confidence, 100);
});

test("a mid-confidence match -> REVIEW_REQUIRED with NO officer link (candidate found but not linked)", () => {
  const result = decideMatchForPhoto([officer()], image({ ocrText: "อนิรุทธิ์ ขาวจันทร์คง 081-540-7336" }));
  assert.equal(result.matchStatus, MatchStatus.ReviewRequired);
  assert.equal(result.matchedOfficerId, null);
  assert.ok(typeof result.confidence === "number" && result.confidence >= 80 && result.confidence < 98);
});

test("no signal at all -> UNKNOWN, no link, no confidence", () => {
  const result = decideMatchForPhoto([officer()], image({ ocrText: "completely unrelated text" }));
  assert.equal(result.matchStatus, MatchStatus.Unknown);
  assert.equal(result.matchedOfficerId, null);
  assert.equal(result.confidence, null);
});

test("a clear winner beats a same-name-only runner-up (not a conflict, since only one phone matches)", () => {
  const a = officer({ officerId: "A", fullName: "สมชาย ใจดี", phone: "081-111-1111" });
  const b = officer({ officerId: "B", fullName: "สมชาย ใจดี", phone: "081-222-2222" });
  // "a" scores name+phone (80); "b" scores name only (55) — its phone doesn't
  // appear in the OCR text, so this is a clear winner, not a genuine tie.
  const result = decideMatchForPhoto([a, b], image({ ocrText: "สมชาย ใจดี 081-111-1111" }));
  assert.equal(result.matchStatus, MatchStatus.ReviewRequired);
  assert.equal(result.matchedOfficerId, null); // ReviewRequired never auto-links
});

test("genuine tie (identical signals for two officers) -> CONFLICT, no link", () => {
  // Both officers share the same name AND phone, so both clear the
  // needs-review threshold with IDENTICAL confidence — a genuine,
  // unresolvable tie.
  const a = officer({ officerId: "A", fullName: "สมชาย ใจดี", phone: "081-999-9999" });
  const b = officer({ officerId: "B", fullName: "สมชาย ใจดี", phone: "081-999-9999" });
  const result = decideMatchForPhoto([a, b], image({ ocrText: "สมชาย ใจดี 081-999-9999" }));
  assert.equal(result.matchStatus, MatchStatus.Conflict);
  assert.equal(result.matchedOfficerId, null);
});

test("decideMatchesForPhotos: duplicate cross-photo claim -> lower-confidence one becomes DUPLICATE, no link", () => {
  const o = officer();
  // Strong: fullName(55) + rank(10) + unit(20) + phone(25) = 100 (capped).
  const strongImage = image({ fileId: "strong", ocrText: "ร.ต.ท. อนิรุทธิ์ ขาวจันทร์คง ตชด.447 081-540-7336" });
  // Weaker: fullName(55) + phone(25) = 80 — clears the review threshold
  // (eligible to be flagged a duplicate) but scores lower than the strong image.
  const weakerImage = image({ fileId: "weaker", ocrText: "อนิรุทธิ์ ขาวจันทร์คง 081-540-7336" });

  const results = decideMatchesForPhotos([o], [strongImage, weakerImage]);
  assert.equal(results.get("strong")?.matchStatus, MatchStatus.AutoMatched);
  assert.equal(results.get("strong")?.matchedOfficerId, "ภาค1/5");
  assert.equal(results.get("weaker")?.matchStatus, MatchStatus.Duplicate);
  assert.equal(results.get("weaker")?.matchedOfficerId, null);
});

test("empty officer list -> every image is UNKNOWN, never crashes", () => {
  const results = decideMatchesForPhotos([], [image({ fileId: "a" }), image({ fileId: "b" })]);
  assert.equal(results.get("a")?.matchStatus, MatchStatus.Unknown);
  assert.equal(results.get("b")?.matchStatus, MatchStatus.Unknown);
});
