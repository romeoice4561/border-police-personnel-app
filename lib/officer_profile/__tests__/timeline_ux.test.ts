import { test } from "node:test";
import assert from "node:assert/strict";

import {
  reorder,
  moveUp,
  moveDown,
  deriveCardStatus,
  legacyVerifiedFromStatus,
  verificationBadgeMeta,
  deriveTimelineWarnings,
  LEGACY_VERIFIED_CONFIRMED,
  LEGACY_VERIFIED_CHECKED,
  LEGACY_VERIFIED_UNCHECKED,
} from "@/lib/officer_profile/timeline_ux";
import type { TimelineDraftRow } from "@/components/officer/use_officer_workspace";

// Phase 45 — Timeline UX pure helpers.

function row(ov: Partial<TimelineDraftRow> & { key: string }): TimelineDraftRow {
  return {
    year: "",
    rank: "",
    position: "ตำแหน่ง",
    positionLevel: "Unknown",
    unit: "",
    source: "",
    verified: "ยังไม่ตรวจ",
    day: null,
    month: null,
    yearBE: null,
    appointmentCycle: null,
    isPresent: false,
    headquartersId: null,
    headquartersText: "",
    regionId: null,
    regionText: "",
    battalionId: null,
    battalionText: "",
    companyId: null,
    companyText: "",
    verificationStatus: "",
    verifiedBy: "",
    verifiedDate: "",
    verificationRemark: "",
    ...ov,
  };
}

// ── reorder / moveUp / moveDown ──

test("reorder moves an item and is immutable", () => {
  const src = ["a", "b", "c", "d"];
  const out = reorder(src, 0, 2);
  assert.deepEqual(out, ["b", "c", "a", "d"]);
  assert.deepEqual(src, ["a", "b", "c", "d"]); // unchanged
});

test("reorder clamps out-of-range target and ignores bad from", () => {
  assert.deepEqual(reorder(["a", "b", "c"], 0, 99), ["b", "c", "a"]);
  assert.deepEqual(reorder(["a", "b", "c"], 5, 0), ["a", "b", "c"]);
});

test("moveUp/moveDown are no-ops at the ends", () => {
  assert.deepEqual(moveUp(["a", "b", "c"], 0), ["a", "b", "c"]);
  assert.deepEqual(moveDown(["a", "b", "c"], 2), ["a", "b", "c"]);
  assert.deepEqual(moveUp(["a", "b", "c"], 1), ["b", "a", "c"]);
  assert.deepEqual(moveDown(["a", "b", "c"], 1), ["a", "c", "b"]);
});

// ── deriveCardStatus ──

test("deriveCardStatus reflects real save signals with correct precedence", () => {
  assert.equal(deriveCardStatus({ key: "draft-1" }, { isSaving: true }), "saving");
  assert.equal(deriveCardStatus({ key: "draft-1" }, { hasError: true }), "error");
  assert.equal(deriveCardStatus({ key: "draft-9" }, {}), "draft");
  assert.equal(deriveCardStatus({ key: "row-42" }, {}), "saved");
  // saving takes precedence over error/draft
  assert.equal(deriveCardStatus({ key: "draft-1" }, { isSaving: true, hasError: true }), "saving");
});

// ── verification sync (Part 6) ──

test("legacyVerifiedFromStatus maps the structured status to the legacy free-text column", () => {
  assert.equal(legacyVerifiedFromStatus("VERIFIED"), LEGACY_VERIFIED_CONFIRMED);
  assert.equal(legacyVerifiedFromStatus("PENDING"), LEGACY_VERIFIED_CHECKED);
  assert.equal(legacyVerifiedFromStatus("NEEDS_REVIEW"), LEGACY_VERIFIED_CHECKED);
  assert.equal(legacyVerifiedFromStatus("REJECTED"), LEGACY_VERIFIED_UNCHECKED);
  assert.equal(legacyVerifiedFromStatus(""), LEGACY_VERIFIED_UNCHECKED);
  assert.equal(legacyVerifiedFromStatus("garbage"), LEGACY_VERIFIED_UNCHECKED);
});

test("verificationBadgeMeta returns bilingual label + tone, or null when unset", () => {
  const v = verificationBadgeMeta("VERIFIED");
  assert.ok(v);
  assert.equal(v!.tone, "good");
  assert.equal(v!.labelEn, "Verified");
  assert.equal(verificationBadgeMeta(""), null);
  assert.equal(verificationBadgeMeta("nope"), null);
});

// ── validation warnings (Part 8/9) — advisory only ──

test("no warnings for a clean, single-current, ordered timeline", () => {
  const rows = [
    row({ key: "a", yearBE: 2560, position: "A" }),
    row({ key: "b", yearBE: 2565, position: "B", isPresent: true }),
  ];
  assert.deepEqual(deriveTimelineWarnings(rows), []);
});

test("flags more than one current position", () => {
  const rows = [
    row({ key: "a", yearBE: 2560, isPresent: true }),
    row({ key: "b", yearBE: 2565, isPresent: true }),
  ];
  const w = deriveTimelineWarnings(rows).find((x) => x.code === "MULTIPLE_CURRENT");
  assert.ok(w);
  assert.deepEqual(w!.rowKeys.sort(), ["a", "b"]);
});

test("flags missing important fields (no year AND no legacy year, or no position)", () => {
  const rows = [
    row({ key: "a", yearBE: null, year: "", position: "" }),
    row({ key: "b", yearBE: 2565, position: "ok" }),
  ];
  const w = deriveTimelineWarnings(rows).find((x) => x.code === "MISSING_FIELDS");
  assert.ok(w);
  assert.deepEqual(w!.rowKeys, ["a"]);
});

test("a legacy free-text year with no structured year is NOT missing", () => {
  const rows = [row({ key: "a", yearBE: null, year: "2567-ปัจจุบัน", position: "ok" })];
  assert.equal(deriveTimelineWarnings(rows).some((x) => x.code === "MISSING_FIELDS"), false);
});

test("flags overlapping (duplicate) years", () => {
  const rows = [
    row({ key: "a", yearBE: 2560 }),
    row({ key: "b", yearBE: 2560 }),
    row({ key: "c", yearBE: 2565 }),
  ];
  const w = deriveTimelineWarnings(rows).find((x) => x.code === "OVERLAPPING_PERIOD");
  assert.ok(w);
  assert.deepEqual(w!.rowKeys.sort(), ["a", "b"]);
});

test("flags a local year-order inversion against the dominant direction", () => {
  // Mostly ascending, but c(2562) sits after b(2568) — an inversion.
  const rows = [
    row({ key: "a", yearBE: 2560 }),
    row({ key: "b", yearBE: 2568 }),
    row({ key: "c", yearBE: 2562 }),
    row({ key: "d", yearBE: 2570 }),
  ];
  const w = deriveTimelineWarnings(rows).find((x) => x.code === "YEAR_ORDER");
  assert.ok(w);
  assert.ok(w!.rowKeys.includes("c"));
});

test("a consistently descending timeline is NOT flagged for year order", () => {
  const rows = [
    row({ key: "a", yearBE: 2570 }),
    row({ key: "b", yearBE: 2565 }),
    row({ key: "c", yearBE: 2560 }),
  ];
  assert.equal(deriveTimelineWarnings(rows).some((x) => x.code === "YEAR_ORDER"), false);
});

test("empty input yields no warnings (never throws)", () => {
  assert.deepEqual(deriveTimelineWarnings([]), []);
});
