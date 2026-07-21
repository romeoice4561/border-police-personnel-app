import { test } from "node:test";
import assert from "node:assert/strict";

import { buildCommanderDashboard } from "@/lib/intelligence/commander_dashboard";
import { computeDocumentReadiness } from "@/lib/intelligence/document_readiness";
import { computeReviewWorkload } from "@/lib/intelligence/review_workload";
import { fixtureDoc } from "@/lib/intelligence/__tests__/test_fixtures";
import type { CommanderSummary } from "@/lib/extraction/commander_view";

const ASOF = new Date("2026-07-21T12:00:00.000Z");

function fakeExtractionSummary(): CommanderSummary {
  return {
    todaysOcrCount: 0,
    todaysAiCount: 0,
    documentsPendingReview: 0,
    budgetRemaining: {
      dailyCalls: 0, dailyLimit: null, dailyRemaining: null,
      monthlyCalls: 0, monthlyLimit: null, monthlyRemaining: null,
      perUserDailyCalls: null, perUserDailyLimit: null, perUserDailyRemaining: null,
      budgetExhausted: false, aiDisabled: false,
    },
    mostCommonDocumentTypes: [],
    topValidationFailures: [],
    topOcrErrors: [],
    topDuplicateDocuments: [],
  };
}

test("a document uploaded today counts toward todaysUploads; one uploaded yesterday does not", () => {
  const today = fixtureDoc({ documentType: "NATIONAL_ID", uploadedAt: new Date("2026-07-21T08:00:00.000Z") });
  const yesterday = fixtureDoc({ documentType: "DRIVER_LICENSE", uploadedAt: new Date("2026-07-20T08:00:00.000Z") });
  const dashboard = buildCommanderDashboard({
    extractionSummary: fakeExtractionSummary(),
    readinessRecords: [],
    workload: computeReviewWorkload({ officerId: 1, documents: [] }, ASOF),
    documentListsForExpiry: [[today, yesterday]],
    asOf: ASOF,
  });
  assert.equal(dashboard.todaysUploads, 1);
});

test("todaysCompletedReviews is always 0 in this phase (no review-completion timestamp exists) — honest, not fabricated", () => {
  const dashboard = buildCommanderDashboard({
    extractionSummary: fakeExtractionSummary(),
    readinessRecords: [],
    workload: computeReviewWorkload({ officerId: 1, documents: [] }, ASOF),
    documentListsForExpiry: [],
    asOf: ASOF,
  });
  assert.equal(dashboard.todaysCompletedReviews, 0);
});

test("officersNeedingReview and officersWithBlockedDocuments reflect real readiness records", () => {
  const blockedDocs = [fixtureDoc({ documentType: "NATIONAL_ID", expiryDate: new Date("2020-01-01"), verifiedAt: new Date("2020-01-01") })];
  const record = { officerId: 1, readiness: computeDocumentReadiness({ documents: blockedDocs, asOf: ASOF }) };
  const dashboard = buildCommanderDashboard({
    extractionSummary: fakeExtractionSummary(),
    readinessRecords: [record],
    workload: computeReviewWorkload({ officerId: 1, documents: [] }, ASOF),
    documentListsForExpiry: [],
    asOf: ASOF,
  });
  assert.equal(dashboard.officersWithBlockedDocuments, 1);
  assert.equal(dashboard.officersNeedingReview, 0);
});

test("upcomingExpirations only includes expired/expiring_soon documents, sorted most-urgent-first", () => {
  const soon = new Date(ASOF);
  soon.setUTCDate(soon.getUTCDate() + 5);
  const docs = [
    fixtureDoc({ documentType: "NATIONAL_ID", expiryDate: new Date("2020-01-01") }), // expired
    fixtureDoc({ documentType: "DRIVER_LICENSE", expiryDate: soon }), // expiring soon
    fixtureDoc({ documentType: "PASSPORT", expiryDate: new Date("2030-01-01") }), // valid, excluded
  ];
  const dashboard = buildCommanderDashboard({
    extractionSummary: fakeExtractionSummary(),
    readinessRecords: [],
    workload: computeReviewWorkload({ officerId: 1, documents: [] }, ASOF),
    documentListsForExpiry: [docs],
    asOf: ASOF,
  });
  assert.equal(dashboard.upcomingExpirations.length, 2);
  assert.equal(dashboard.upcomingExpirations[0].status, "expired");
});

test("averageDocumentCompleteness is null when readinessRecords is empty", () => {
  const dashboard = buildCommanderDashboard({
    extractionSummary: fakeExtractionSummary(),
    readinessRecords: [],
    workload: computeReviewWorkload({ officerId: 1, documents: [] }, ASOF),
    documentListsForExpiry: [],
    asOf: ASOF,
  });
  assert.equal(dashboard.averageDocumentCompleteness, null);
});

test("extractionSummary is passed through unmodified", () => {
  const summary = fakeExtractionSummary();
  const dashboard = buildCommanderDashboard({
    extractionSummary: summary,
    readinessRecords: [],
    workload: computeReviewWorkload({ officerId: 1, documents: [] }, ASOF),
    documentListsForExpiry: [],
    asOf: ASOF,
  });
  assert.equal(dashboard.extractionSummary, summary);
});
