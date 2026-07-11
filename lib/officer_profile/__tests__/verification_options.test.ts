import { test } from "node:test";
import assert from "node:assert/strict";

import {
  TIMELINE_VERIFICATION_STATUS_OPTIONS,
  VERIFICATION_STATUS_META,
  isValidTimelineVerificationStatus,
  VERIFIED_BY_OPTIONS,
} from "@/lib/officer_profile/verification_options";

test("exactly 4 verification statuses, matching Part H", () => {
  assert.deepEqual([...TIMELINE_VERIFICATION_STATUS_OPTIONS], ["VERIFIED", "PENDING", "REJECTED", "NEEDS_REVIEW"]);
});

test("every status has bilingual labels and a color token", () => {
  for (const status of TIMELINE_VERIFICATION_STATUS_OPTIONS) {
    const meta = VERIFICATION_STATUS_META[status];
    assert.ok(meta.labelTh.length > 0);
    assert.ok(meta.labelEn.length > 0);
    assert.ok(meta.color.length > 0);
  }
});

test("VERIFIED is green (good), PENDING is orange (serious), REJECTED is red (critical), NEEDS_REVIEW is blue (accent)", () => {
  assert.equal(VERIFICATION_STATUS_META.VERIFIED.color, "good");
  assert.equal(VERIFICATION_STATUS_META.PENDING.color, "serious");
  assert.equal(VERIFICATION_STATUS_META.REJECTED.color, "critical");
  assert.equal(VERIFICATION_STATUS_META.NEEDS_REVIEW.color, "accent");
});

test("isValidTimelineVerificationStatus accepts the 4 valid values, rejects everything else", () => {
  for (const status of TIMELINE_VERIFICATION_STATUS_OPTIONS) {
    assert.equal(isValidTimelineVerificationStatus(status), true);
  }
  assert.equal(isValidTimelineVerificationStatus("ยืนยันแล้ว"), false);
  assert.equal(isValidTimelineVerificationStatus(""), false);
  assert.equal(isValidTimelineVerificationStatus("verified"), false); // case-sensitive
});

test("VERIFIED_BY_OPTIONS matches Part H's default list", () => {
  assert.deepEqual([...VERIFIED_BY_OPTIONS], ["Admin", "เจ้าหน้าที่กำลังพล", "กำลังพล", "ผู้บังคับบัญชา", "เจ้าของข้อมูล"]);
});
