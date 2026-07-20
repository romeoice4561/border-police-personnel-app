import { test } from "node:test";
import assert from "node:assert/strict";

import {
  daysRemaining,
  expiryStatus,
  computeExpiryInfo,
  sortByUrgency,
  groupByStatus,
  groupByTimelineBucket,
  summary,
  EXPIRING_SOON_THRESHOLD_DAYS,
} from "@/lib/document/document_expiry";
import type { OfficerDocument } from "@/lib/database/query_types";

// Phase 47 — Document Expiry Intelligence Engine (pure, no React/DB).

let nextId = 1;
function doc(ov: Partial<OfficerDocument>): OfficerDocument {
  return {
    id: nextId++,
    officerId: 1,
    documentType: "NATIONAL_ID",
    title: "Doc",
    description: null,
    storagePath: null,
    fileUrl: null,
    originalFilename: null,
    mimeType: null,
    fileSize: null,
    uploadedAt: null,
    uploadedBy: null,
    verifiedAt: null,
    verifiedBy: null,
    issueDate: null,
    expiryDate: null,
    renewalDate: null,
    version: 1,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...ov,
  } as OfficerDocument;
}

const NOW = new Date("2026-07-20T12:00:00Z");

// ── daysRemaining ────────────────────────────────────────────────────────────

test("daysRemaining: same calendar day is 0", () => {
  assert.equal(daysRemaining(new Date("2026-07-20T23:00:00Z"), NOW), 0);
});

test("daysRemaining: a future date returns a positive count", () => {
  assert.equal(daysRemaining(new Date("2026-08-19T00:00:00Z"), NOW), 30);
});

test("daysRemaining: a past date returns a negative count", () => {
  assert.equal(daysRemaining(new Date("2026-07-10T00:00:00Z"), NOW), -10);
});

test("daysRemaining: accepts a string date", () => {
  assert.equal(daysRemaining("2026-07-25", NOW), 5);
});

// ── expiryStatus ─────────────────────────────────────────────────────────────

test("expiryStatus: null/undefined expiryDate is 'unknown'", () => {
  assert.equal(expiryStatus(null, NOW), "unknown");
  assert.equal(expiryStatus(undefined, NOW), "unknown");
});

test("expiryStatus: a past date is 'expired'", () => {
  assert.equal(expiryStatus(new Date("2026-07-01"), NOW), "expired");
});

test("expiryStatus: exactly today is NOT expired (0 days remaining, still valid-ish window)", () => {
  assert.equal(expiryStatus(new Date("2026-07-20"), NOW), "expiring_soon");
});

test(`expiryStatus: within ${EXPIRING_SOON_THRESHOLD_DAYS} days is 'expiring_soon'`, () => {
  const soon = new Date(NOW);
  soon.setDate(soon.getDate() + EXPIRING_SOON_THRESHOLD_DAYS);
  assert.equal(expiryStatus(soon, NOW), "expiring_soon");
});

test("expiryStatus: more than the threshold is 'valid'", () => {
  const later = new Date(NOW);
  later.setDate(later.getDate() + EXPIRING_SOON_THRESHOLD_DAYS + 1);
  assert.equal(expiryStatus(later, NOW), "valid");
});

// ── computeExpiryInfo ────────────────────────────────────────────────────────

test("computeExpiryInfo: excludes inactive (superseded) documents", () => {
  const inactive = doc({ isActive: false, expiryDate: new Date("2026-06-01") });
  const info = computeExpiryInfo([inactive], NOW);
  assert.equal(info.length, 0);
});

test("computeExpiryInfo: daysRemaining is null when status is unknown", () => {
  const noExpiry = doc({ expiryDate: null });
  const info = computeExpiryInfo([noExpiry], NOW);
  assert.equal(info[0].status, "unknown");
  assert.equal(info[0].daysRemaining, null);
});

test("computeExpiryInfo: daysRemaining is a real number when expiryDate is set", () => {
  const expiring = doc({ expiryDate: new Date("2026-08-01") });
  const info = computeExpiryInfo([expiring], NOW);
  assert.equal(info[0].daysRemaining, 12);
});

// ── sortByUrgency ────────────────────────────────────────────────────────────

test("sortByUrgency: expired sorts before expiring_soon, which sorts before valid, which sorts before unknown", () => {
  const valid = doc({ expiryDate: new Date("2027-01-01") });
  const expired = doc({ expiryDate: new Date("2026-01-01") });
  const soon = doc({ expiryDate: new Date("2026-08-01") });
  const unknown = doc({ expiryDate: null });
  const info = computeExpiryInfo([valid, unknown, expired, soon], NOW);
  const sorted = sortByUrgency(info);
  assert.deepEqual(sorted.map((i) => i.status), ["expired", "expiring_soon", "valid", "unknown"]);
});

test("sortByUrgency: within the same status, sorts by soonest deadline first", () => {
  const soon10 = doc({ documentType: "A", expiryDate: new Date("2026-07-30") });
  const soon5 = doc({ documentType: "B", expiryDate: new Date("2026-07-25") });
  const info = computeExpiryInfo([soon10, soon5], NOW);
  const sorted = sortByUrgency(info);
  assert.equal(sorted[0].document.documentType, "B");
  assert.equal(sorted[1].document.documentType, "A");
});

test("sortByUrgency: does not mutate the input array", () => {
  const a = doc({ expiryDate: new Date("2026-08-01") });
  const b = doc({ expiryDate: new Date("2026-07-25") });
  const info = computeExpiryInfo([a, b], NOW);
  const original = [...info];
  sortByUrgency(info);
  assert.deepEqual(info, original);
});

// ── groupByStatus ────────────────────────────────────────────────────────────

test("groupByStatus: buckets every item into exactly one of the 4 status groups", () => {
  const docs = [
    doc({ expiryDate: new Date("2026-01-01") }), // expired
    doc({ expiryDate: new Date("2026-08-01") }), // expiring soon
    doc({ expiryDate: new Date("2028-01-01") }), // valid
    doc({ expiryDate: null }), // unknown
  ];
  const groups = groupByStatus(computeExpiryInfo(docs, NOW));
  assert.equal(groups.expired.length, 1);
  assert.equal(groups.expiring_soon.length, 1);
  assert.equal(groups.valid.length, 1);
  assert.equal(groups.unknown.length, 1);
});

test("groupByStatus: empty input returns all-empty groups, never crashes", () => {
  const groups = groupByStatus([]);
  assert.deepEqual(groups, { expired: [], expiring_soon: [], valid: [], unknown: [] });
});

// ── groupByTimelineBucket ────────────────────────────────────────────────────

test("groupByTimelineBucket: buckets into Expired/Next30/Next60/Next90/Later/Unknown correctly", () => {
  const docs = [
    doc({ documentType: "EXPIRED", expiryDate: new Date("2026-06-01") }),
    doc({ documentType: "IN20", expiryDate: new Date("2026-08-09") }), // 20 days
    doc({ documentType: "IN45", expiryDate: new Date("2026-09-03") }), // 45 days
    doc({ documentType: "IN75", expiryDate: new Date("2026-10-03") }), // 75 days
    doc({ documentType: "IN200", expiryDate: new Date("2027-02-05") }), // 200 days
    doc({ documentType: "UNKNOWN_DOC", expiryDate: null }),
  ];
  const buckets = groupByTimelineBucket(computeExpiryInfo(docs, NOW));
  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b.items.map((i) => i.document.documentType)]));
  assert.deepEqual(byKey.expired, ["EXPIRED"]);
  assert.deepEqual(byKey.next30, ["IN20"]);
  assert.deepEqual(byKey.next60, ["IN45"]);
  assert.deepEqual(byKey.next90, ["IN75"]);
  assert.deepEqual(byKey.later, ["IN200"]);
  assert.deepEqual(byKey.unknown, ["UNKNOWN_DOC"]);
});

test("groupByTimelineBucket: omits empty buckets entirely", () => {
  const onlyValid = doc({ expiryDate: new Date("2030-01-01") });
  const buckets = groupByTimelineBucket(computeExpiryInfo([onlyValid], NOW));
  assert.equal(buckets.length, 1);
  assert.equal(buckets[0].key, "later");
});

test("groupByTimelineBucket: empty input returns an empty array", () => {
  assert.deepEqual(groupByTimelineBucket([]), []);
});

// ── summary ──────────────────────────────────────────────────────────────────

test("summary: counts match groupByStatus exactly, never fabricated", () => {
  const docs = [
    doc({ expiryDate: new Date("2026-01-01") }),
    doc({ expiryDate: new Date("2026-08-01") }),
    doc({ expiryDate: new Date("2028-01-01") }),
    doc({ expiryDate: null }),
    doc({ expiryDate: null }),
  ];
  const info = computeExpiryInfo(docs, NOW);
  const s = summary(info);
  assert.equal(s.expiredCount, 1);
  assert.equal(s.expiringSoonCount, 1);
  assert.equal(s.validCount, 1);
  assert.equal(s.unknownCount, 2);
  assert.equal(s.totalTracked, 5);
});

test("summary: zero documents returns all-zero counts, never crashes", () => {
  const s = summary([]);
  assert.deepEqual(s, { expiringSoonCount: 0, expiredCount: 0, unknownCount: 0, validCount: 0, totalTracked: 0 });
});
