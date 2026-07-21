import { test } from "node:test";
import assert from "node:assert/strict";

import {
  countByReadinessLevel,
  readyOfficerCount,
  officersNeedingReviewCount,
  officersBlockedCount,
  averageCompletenessScore,
  pendingReviewTotal,
  expiringSoonCount,
  unsupportedDocumentCount,
} from "@/lib/intelligence/kpi_definitions";
import { computeDocumentReadiness } from "@/lib/intelligence/document_readiness";
import { computeReviewWorkload } from "@/lib/intelligence/review_workload";
import { unsupportedFormatReviewStatus } from "@/lib/intelligence/document_review_status";
import { fixtureDoc } from "@/lib/intelligence/__tests__/test_fixtures";

const ASOF = new Date("2026-07-21");

function record(officerId: number, documents: ReturnType<typeof fixtureDoc>[]) {
  return { officerId, readiness: computeDocumentReadiness({ documents, asOf: ASOF }) };
}

test("countByReadinessLevel tallies every officer into exactly one bucket", () => {
  const records = [record(1, []), record(2, [])];
  const counts = countByReadinessLevel(records);
  assert.equal(counts.INCOMPLETE, 2);
  assert.equal(counts.READY, 0);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.equal(total, records.length);
});

test("readyOfficerCount / officersNeedingReviewCount / officersBlockedCount count only their own level", () => {
  const readyDocs = [
    fixtureDoc({ documentType: "NATIONAL_ID", expiryDate: new Date("2030-01-01"), verifiedAt: new Date("2026-01-01") }),
    fixtureDoc({ documentType: "GP7", verifiedAt: new Date("2026-01-01") }),
    fixtureDoc({ documentType: "HOUSE_REGISTRATION", verifiedAt: new Date("2026-01-01") }),
    fixtureDoc({ documentType: "EDUCATION_CERTIFICATE", verifiedAt: new Date("2026-01-01") }),
    fixtureDoc({ documentType: "TRAINING_CERTIFICATE", verifiedAt: new Date("2026-01-01") }),
    fixtureDoc({ documentType: "AWARD", verifiedAt: new Date("2026-01-01") }),
    fixtureDoc({ documentType: "MEDICAL_DOCUMENT", verifiedAt: new Date("2026-01-01") }),
    fixtureDoc({ documentType: "SALARY_DOCUMENT", verifiedAt: new Date("2026-01-01") }),
    fixtureDoc({ documentType: "ANNUAL_EVALUATION", verifiedAt: new Date("2026-01-01") }),
    fixtureDoc({ documentType: "FIREARMS_QUALIFICATION", verifiedAt: new Date("2026-01-01") }),
  ];
  const records = [record(1, readyDocs), record(2, [])];
  assert.equal(readyOfficerCount(records), 1);
  assert.equal(officersNeedingReviewCount(records), 0);
  assert.equal(officersBlockedCount(records), 0);
});

test("averageCompletenessScore is null for an empty list, never a fabricated 0", () => {
  assert.equal(averageCompletenessScore([]), null);
});

test("averageCompletenessScore is the mean of each record's completeness.overallScore", () => {
  const records = [record(1, []), record(2, [])];
  const avg = averageCompletenessScore(records);
  assert.equal(avg, records[0].readiness.completeness.overallScore);
});

test("pendingReviewTotal sums all 5 workload categories", () => {
  const doc = fixtureDoc({ documentType: "NATIONAL_ID", id: 1, verifiedAt: null });
  const workload = computeReviewWorkload({ officerId: 1, documents: [doc] }, ASOF);
  const total = pendingReviewTotal(workload);
  const expected =
    workload.pendingOcrReviews.length +
    workload.pendingManualApprovals.length +
    workload.pendingAiSuggestions.length +
    workload.pendingExpiryActions.length +
    workload.unsupportedDocuments.length;
  assert.equal(total, expected);
});

test("expiringSoonCount only counts active documents within the standard threshold, across multiple officers' lists", () => {
  const soon = new Date(ASOF);
  soon.setUTCDate(soon.getUTCDate() + 10);
  const officer1Docs = [fixtureDoc({ documentType: "NATIONAL_ID", expiryDate: soon })];
  const officer2Docs = [fixtureDoc({ documentType: "DRIVER_LICENSE", expiryDate: new Date("2030-01-01") })];
  const count = expiringSoonCount([officer1Docs, officer2Docs], ASOF);
  assert.equal(count, 1);
});

test("unsupportedDocumentCount reuses ReviewWorkload.unsupportedDocuments rather than recomputing", () => {
  const doc = fixtureDoc({ documentType: "GP7", id: 5 });
  const review = unsupportedFormatReviewStatus(5);
  const workload = computeReviewWorkload({ officerId: 1, documents: [doc], reviewStatusByDocumentId: new Map([[5, review]]) }, ASOF);
  assert.equal(unsupportedDocumentCount(workload), workload.unsupportedDocuments.length);
});
