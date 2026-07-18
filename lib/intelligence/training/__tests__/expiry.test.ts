import assert from "node:assert/strict";
import test from "node:test";
import { utcDate } from "@/lib/personnel_calendar";
import { computeExpirySummary } from "@/lib/intelligence/training/expiry";

const ASOF = utcDate(2026, 7, 17);

test("12. expiry supported and valid (> 90 days remaining) -> valid band", () => {
  const result = computeExpirySummary("2027-06-01", ASOF);
  assert.equal(result.available, true);
  assert.equal(result.band, "valid");
});

test("13. expiring soon (31-90 days remaining)", () => {
  const result = computeExpirySummary("2026-08-20", ASOF); // ~34 days
  assert.equal(result.band, "expiring_soon");
});

test("14. urgent (1-30 days remaining)", () => {
  const result = computeExpirySummary("2026-08-01", ASOF); // ~15 days
  assert.equal(result.band, "urgent");
});

test("expires today (0 days remaining)", () => {
  const result = computeExpirySummary("2026-07-17", ASOF);
  assert.equal(result.band, "expires_today");
  assert.equal(result.remainingDays, 0);
});

test("15. expired (negative days remaining)", () => {
  const result = computeExpirySummary("2026-01-01", ASOF);
  assert.equal(result.band, "expired");
  assert.ok(result.remainingDays! < 0);
});

test("16. no expiry field supported (null expiryDate) -> unavailable, never a fabricated band", () => {
  const result = computeExpirySummary(null, ASOF);
  assert.equal(result.available, false);
  assert.equal(result.band, null);
  assert.equal(result.remainingDays, null);
});

test("11. invalid date string -> unavailable, not a crash", () => {
  const result = computeExpirySummary("not-a-date", ASOF);
  assert.equal(result.available, false);
});

test("never stores a countdown — remainingDays is always recomputed relative to asOf", () => {
  const earlier = computeExpirySummary("2026-08-01", utcDate(2026, 7, 1));
  const later = computeExpirySummary("2026-08-01", utcDate(2026, 7, 20));
  assert.notEqual(earlier.remainingDays, later.remainingDays);
});
