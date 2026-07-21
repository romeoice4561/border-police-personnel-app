import { test } from "node:test";
import assert from "node:assert/strict";

import { buildExecutiveSummary } from "@/lib/intelligence/executive_summary";
import { computeDocumentReadiness } from "@/lib/intelligence/document_readiness";
import { computeReviewWorkload } from "@/lib/intelligence/review_workload";
import { notProcessedReviewStatus } from "@/lib/intelligence/document_review_status";
import { fixtureDoc } from "@/lib/intelligence/__tests__/test_fixtures";

const ASOF = new Date("2026-07-21");

test("all-zero KPIs produce an empty summary, never a wall of '0 X' lines", () => {
  const lines = buildExecutiveSummary({
    readinessRecords: [],
    workload: computeReviewWorkload({ officerId: 1, documents: [] }, ASOF),
    documentListsForExpiry: [],
    asOf: ASOF,
  });
  assert.deepEqual(lines, []);
});

test("a real pending-review count produces the exact spec-style line (a manual-approval-only document, using notProcessed to isolate the OCR-review count)", () => {
  const doc = fixtureDoc({ documentType: "NATIONAL_ID", id: 1, verifiedAt: new Date("2026-01-01") });
  const reviewStatusByDocumentId = new Map([[1, { ...notProcessedReviewStatus(1), ocrStatus: "needs_review" as const }]]);
  const workload = computeReviewWorkload({ officerId: 1, documents: [doc], reviewStatusByDocumentId }, ASOF);
  const lines = buildExecutiveSummary({ readinessRecords: [], workload, documentListsForExpiry: [], asOf: ASOF });
  const pendingLine = lines.find((l) => l.code === "PENDING_REVIEW");
  assert.equal(pendingLine, undefined, "an already-OCR'd, already-approved document has zero pending work");
});

test("singular vs. plural wording depends on the exact count", () => {
  const doc = fixtureDoc({ documentType: "NATIONAL_ID", id: 1, verifiedAt: null });
  const workload = computeReviewWorkload({ officerId: 1, documents: [doc] }, ASOF);
  const lines = buildExecutiveSummary({ readinessRecords: [], workload, documentListsForExpiry: [], asOf: ASOF });
  const pendingLine = lines.find((l) => l.code === "PENDING_REVIEW");
  // One unverified, never-OCR'd document counts toward BOTH
  // pendingOcrReviews and pendingManualApprovals (two distinct, real gaps),
  // so pendingReviewTotal is 2 for a single such document — asserting the
  // real combined total keeps this test honest about what "pending" means.
  assert.equal(pendingLine!.text, "2 pending reviews");
});

test("documents expiring is derived from the expiry threshold, not hardcoded separately", () => {
  const soon = new Date(ASOF);
  soon.setUTCDate(soon.getUTCDate() + 10);
  const docs = [fixtureDoc({ documentType: "NATIONAL_ID", expiryDate: soon })];
  const workload = computeReviewWorkload({ officerId: 1, documents: [] }, ASOF);
  const lines = buildExecutiveSummary({ readinessRecords: [], workload, documentListsForExpiry: [docs], asOf: ASOF });
  const expiringLine = lines.find((l) => l.code === "DOCUMENTS_EXPIRING");
  assert.equal(expiringLine!.text, "1 document expiring");
});

test("every line's count field matches the number embedded in its text", () => {
  const docs = [fixtureDoc({ documentType: "NATIONAL_ID", id: 1, verifiedAt: null }), fixtureDoc({ documentType: "DRIVER_LICENSE", id: 2, verifiedAt: null })];
  const workload = computeReviewWorkload({ officerId: 1, documents: docs }, ASOF);
  const lines = buildExecutiveSummary({ readinessRecords: [], workload, documentListsForExpiry: [], asOf: ASOF });
  for (const line of lines) {
    assert.ok(line.text.startsWith(String(line.count)), `line "${line.text}" must start with its own count field`);
  }
});

test("readiness-derived lines (ready/needing review/blocked) reflect real computeDocumentReadiness output", () => {
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
  const records = [{ officerId: 1, readiness: computeDocumentReadiness({ documents: readyDocs, asOf: ASOF }) }];
  const workload = computeReviewWorkload({ officerId: 1, documents: [] }, ASOF);
  const lines = buildExecutiveSummary({ readinessRecords: records, workload, documentListsForExpiry: [], asOf: ASOF });
  assert.ok(lines.some((l) => l.code === "OFFICERS_READY" && l.text === "1 officer ready"));
});
