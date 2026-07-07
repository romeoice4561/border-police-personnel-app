import { test } from "node:test";
import assert from "node:assert/strict";

import {
  TIMELINE_SOURCE_OPTIONS,
  TIMELINE_VERIFIED_OPTIONS,
  isValidTimelineSource,
  isValidTimelineVerifiedStatus,
} from "@/lib/officer_profile/timeline_status_options";

test("every listed source is valid; unknown text is not", () => {
  for (const source of TIMELINE_SOURCE_OPTIONS) assert.equal(isValidTimelineSource(source), true);
  assert.equal(isValidTimelineSource("Unknown Source"), false);
});

test("every listed verified status is valid; unknown text is not", () => {
  for (const status of TIMELINE_VERIFIED_OPTIONS) assert.equal(isValidTimelineVerifiedStatus(status), true);
  assert.equal(isValidTimelineVerifiedStatus("Confirmed"), false);
});

test("verified defaults to the unverified status string", () => {
  assert.ok(TIMELINE_VERIFIED_OPTIONS.includes("ยังไม่ตรวจ"));
});
