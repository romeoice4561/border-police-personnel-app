import { test } from "node:test";
import assert from "node:assert/strict";

import { computeReviewWorkload, combineReviewWorkloads } from "@/lib/intelligence/review_workload";
import { unsupportedFormatReviewStatus, notProcessedReviewStatus } from "@/lib/intelligence/document_review_status";
import { fixtureDoc } from "@/lib/intelligence/__tests__/test_fixtures";

const ASOF = new Date("2026-07-21T00:00:00.000Z");

test("a document with no review status recorded counts as a pending OCR review", () => {
  const doc = fixtureDoc({ documentType: "NATIONAL_ID", id: 1, uploadedAt: new Date("2026-07-01") });
  const workload = computeReviewWorkload({ officerId: 1, documents: [doc] }, ASOF);
  assert.equal(workload.pendingOcrReviews.length, 1);
  assert.equal(workload.pendingOcrReviews[0].documentId, 1);
});

test("a document with verifiedAt null counts as a pending manual approval", () => {
  const doc = fixtureDoc({ documentType: "NATIONAL_ID", id: 2, verifiedAt: null });
  const workload = computeReviewWorkload({ officerId: 1, documents: [doc] }, ASOF);
  assert.equal(workload.pendingManualApprovals.length, 1);
});

test("a document flagged formatUnsupported counts in unsupportedDocuments", () => {
  const doc = fixtureDoc({ documentType: "GP7", id: 3 });
  const review = unsupportedFormatReviewStatus(3);
  const workload = computeReviewWorkload({ officerId: 1, documents: [doc], reviewStatusByDocumentId: new Map([[3, review]]) }, ASOF);
  assert.equal(workload.unsupportedDocuments.length, 1);
});

test("expired/expiring-soon active documents count as pending expiry actions", () => {
  const soon = new Date(ASOF);
  soon.setUTCDate(soon.getUTCDate() + 10);
  const docs = [
    fixtureDoc({ documentType: "NATIONAL_ID", id: 4, expiryDate: new Date("2020-01-01") }),
    fixtureDoc({ documentType: "DRIVER_LICENSE", id: 5, expiryDate: soon }),
  ];
  const workload = computeReviewWorkload({ officerId: 1, documents: docs }, ASOF);
  assert.equal(workload.pendingExpiryActions.length, 2);
});

test("ageDays is computed from uploadedAt, null when uploadedAt is unknown (never fabricated)", () => {
  const withDate = fixtureDoc({ documentType: "NATIONAL_ID", id: 6, uploadedAt: new Date("2026-07-01"), verifiedAt: null });
  const withoutDate = fixtureDoc({ documentType: "DRIVER_LICENSE", id: 7, uploadedAt: null, verifiedAt: null });
  const workload = computeReviewWorkload({ officerId: 1, documents: [withDate, withoutDate] }, ASOF);
  const withDateEntry = workload.pendingManualApprovals.find((e) => e.documentId === 6);
  const withoutDateEntry = workload.pendingManualApprovals.find((e) => e.documentId === 7);
  assert.equal(withDateEntry?.ageDays, 20);
  assert.equal(withoutDateEntry?.ageDays, null);
});

test("averageReviewAgeDays is null when zero entries have a known age", () => {
  const doc = fixtureDoc({ documentType: "NATIONAL_ID", id: 8, uploadedAt: null, verifiedAt: null });
  const workload = computeReviewWorkload({ officerId: 1, documents: [doc] }, ASOF);
  assert.equal(workload.averageReviewAgeDays, null);
});

test("oldestPendingReview picks the entry with the largest ageDays across all pending categories", () => {
  const older = fixtureDoc({ documentType: "NATIONAL_ID", id: 9, uploadedAt: new Date("2026-01-01"), verifiedAt: null });
  const newer = fixtureDoc({ documentType: "DRIVER_LICENSE", id: 10, uploadedAt: new Date("2026-07-15"), verifiedAt: null });
  const workload = computeReviewWorkload({ officerId: 1, documents: [older, newer] }, ASOF);
  assert.equal(workload.oldestPendingReview?.documentId, 9);
});

test("combineReviewWorkloads merges multiple officers' workloads and recomputes age stats over the combined set", () => {
  const doc1 = fixtureDoc({ documentType: "NATIONAL_ID", id: 11, uploadedAt: new Date("2026-07-01"), verifiedAt: null });
  const doc2 = fixtureDoc({ documentType: "DRIVER_LICENSE", id: 12, uploadedAt: new Date("2026-06-01"), verifiedAt: null });
  const w1 = computeReviewWorkload({ officerId: 1, documents: [doc1] }, ASOF);
  const w2 = computeReviewWorkload({ officerId: 2, documents: [doc2] }, ASOF);
  const combined = combineReviewWorkloads([w1, w2]);
  assert.equal(combined.pendingManualApprovals.length, 2);
  assert.equal(combined.oldestPendingReview?.documentId, 12);
});

test("a not_processed review status is equivalent to no entry at all for the OCR-pending count", () => {
  const doc = fixtureDoc({ documentType: "NATIONAL_ID", id: 13 });
  const withExplicitStatus = computeReviewWorkload({ officerId: 1, documents: [doc], reviewStatusByDocumentId: new Map([[13, notProcessedReviewStatus(13)]]) }, ASOF);
  const withNoEntry = computeReviewWorkload({ officerId: 1, documents: [doc] }, ASOF);
  assert.equal(withExplicitStatus.pendingOcrReviews.length, withNoEntry.pendingOcrReviews.length);
});

test("inactive (superseded) documents are excluded from every workload category", () => {
  const doc = fixtureDoc({ documentType: "NATIONAL_ID", id: 14, isActive: false, verifiedAt: null });
  const workload = computeReviewWorkload({ officerId: 1, documents: [doc] }, ASOF);
  assert.equal(workload.pendingManualApprovals.length, 0);
  assert.equal(workload.pendingOcrReviews.length, 0);
});
