import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeDashboardStats,
  computeCompleteness,
  missingChecklistItems,
  computeRecentActivity,
  computeStorageSummary,
  computeCategoryRollups,
  RECOMMENDED_CHECKLIST_CODES,
} from "@/lib/document/epf_intelligence";
import type { OfficerDocument } from "@/lib/database/query_types";

// Phase 46A — e-PF intelligence derivation (pure functions, no DB/React).

let nextId = 1;
function doc(ov: Partial<OfficerDocument>): OfficerDocument {
  return {
    id: nextId++,
    officerId: 1,
    documentType: "OTHER",
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
    version: 1,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...ov,
  } as OfficerDocument;
}

// ── computeDashboardStats ───────────────────────────────────────────────────

test("computeDashboardStats: zero documents → all-zero/null stats, never fabricated", () => {
  const stats = computeDashboardStats([]);
  assert.equal(stats.totalDocuments, 0);
  assert.equal(stats.categoriesUsed, 0);
  assert.equal(stats.totalStorageBytes, 0);
  assert.equal(stats.largestDocument, null);
  assert.equal(stats.mostRecentDocument, null);
});

test("computeDashboardStats: counts only active documents, ignores superseded versions", () => {
  const d1 = doc({ documentType: "GP7", isActive: false, version: 1, fileSize: 100 });
  const d2 = doc({ documentType: "GP7", isActive: true, version: 2, fileSize: 200 });
  const stats = computeDashboardStats([d1, d2]);
  assert.equal(stats.totalDocuments, 1);
  assert.equal(stats.totalStorageBytes, 200);
});

test("computeDashboardStats: largestDocument picks the max fileSize among active docs", () => {
  const small = doc({ documentType: "GP7", fileSize: 100 });
  const large = doc({ documentType: "NATIONAL_ID", fileSize: 5000 });
  const stats = computeDashboardStats([small, large]);
  assert.equal(stats.largestDocument?.id, large.id);
});

test("computeDashboardStats: mostRecentDocument picks the latest uploadedAt", () => {
  const older = doc({ documentType: "GP7", uploadedAt: new Date("2026-01-01") });
  const newer = doc({ documentType: "NATIONAL_ID", uploadedAt: new Date("2026-06-01") });
  const stats = computeDashboardStats([older, newer]);
  assert.equal(stats.mostRecentDocument?.id, newer.id);
});

test("computeDashboardStats: documents with no fileSize/uploadedAt don't crash or count toward totals", () => {
  const noMeta = doc({ documentType: "GP7", fileSize: null, uploadedAt: null });
  const stats = computeDashboardStats([noMeta]);
  assert.equal(stats.totalDocuments, 1);
  assert.equal(stats.totalStorageBytes, 0);
  assert.equal(stats.largestDocument, null);
  assert.equal(stats.mostRecentDocument, null);
});

// ── computeCompleteness ──────────────────────────────────────────────────────

test("computeCompleteness: no documents, no portrait → 0% complete, every item missing", () => {
  const result = computeCompleteness([], false);
  assert.equal(result.percent, 0);
  assert.equal(result.presentCount, 0);
  assert.equal(result.totalCount, RECOMMENDED_CHECKLIST_CODES.length);
  assert.ok(result.items.every((i) => i.state === "missing"));
});

test("computeCompleteness: OFFICIAL_PORTRAIT is present when hasOfficialPortrait=true, independent of documents", () => {
  const result = computeCompleteness([], true);
  const portraitItem = result.items.find((i) => i.code === "OFFICIAL_PORTRAIT");
  assert.equal(portraitItem?.state, "present");
  assert.equal(result.presentCount, 1);
});

test("computeCompleteness: uploading a checklist document flips it to present and increments percent", () => {
  const gp7 = doc({ documentType: "GP7" });
  const result = computeCompleteness([gp7], false);
  const gp7Item = result.items.find((i) => i.code === "GP7");
  assert.equal(gp7Item?.state, "present");
  assert.equal(result.presentCount, 1);
  assert.equal(result.percent, Math.round((1 / RECOMMENDED_CHECKLIST_CODES.length) * 100));
});

test("computeCompleteness: a non-checklist document type does not affect completeness", () => {
  const other = doc({ documentType: "PASSPORT" }); // not in RECOMMENDED_CHECKLIST_CODES
  const result = computeCompleteness([other], false);
  assert.equal(result.presentCount, 0);
});

test("computeCompleteness: full checklist → 100%", () => {
  const docs = RECOMMENDED_CHECKLIST_CODES.filter((c) => c !== "OFFICIAL_PORTRAIT").map((code) => doc({ documentType: code }));
  const result = computeCompleteness(docs, true);
  assert.equal(result.percent, 100);
  assert.equal(result.presentCount, result.totalCount);
});

test("missingChecklistItems returns only missing items, preserving checklist order", () => {
  const gp7 = doc({ documentType: "GP7" });
  const completeness = computeCompleteness([gp7], false);
  const missing = missingChecklistItems(completeness);
  assert.ok(!missing.some((i) => i.code === "GP7"));
  assert.ok(missing.some((i) => i.code === "NATIONAL_ID"));
  assert.deepEqual(
    missing.map((i) => i.code),
    RECOMMENDED_CHECKLIST_CODES.filter((c) => c !== "GP7")
  );
});

// ── computeRecentActivity ─────────────────────────────────────────────────────

test("computeRecentActivity: orders newest first by uploadedAt", () => {
  const older = doc({ documentType: "GP7", uploadedAt: new Date("2026-01-01") });
  const newer = doc({ documentType: "NATIONAL_ID", uploadedAt: new Date("2026-06-01") });
  const activity = computeRecentActivity([older, newer]);
  assert.equal(activity[0].documentType, "NATIONAL_ID");
  assert.equal(activity[1].documentType, "GP7");
});

test("computeRecentActivity: version 1 is 'uploaded', version > 1 is 'updated'", () => {
  const first = doc({ documentType: "GP7", version: 1, uploadedAt: new Date("2026-01-01") });
  const replaced = doc({ documentType: "NATIONAL_ID", version: 3, uploadedAt: new Date("2026-02-01") });
  const activity = computeRecentActivity([first, replaced]);
  const gp7Entry = activity.find((a) => a.documentType === "GP7");
  const idEntry = activity.find((a) => a.documentType === "NATIONAL_ID");
  assert.equal(gp7Entry?.kind, "uploaded");
  assert.equal(idEntry?.kind, "updated");
});

test("computeRecentActivity: excludes inactive (superseded) documents", () => {
  const inactive = doc({ documentType: "GP7", isActive: false, uploadedAt: new Date("2026-05-01") });
  const activity = computeRecentActivity([inactive]);
  assert.equal(activity.length, 0);
});

test("computeRecentActivity: a document with no uploadedAt falls back to updatedAt", () => {
  const fallback = doc({ documentType: "GP7", uploadedAt: null, updatedAt: new Date("2026-04-01") });
  const activity = computeRecentActivity([fallback]);
  assert.equal(activity.length, 1);
  assert.equal(activity[0].at.getTime(), new Date("2026-04-01").getTime());
});

test("computeRecentActivity: respects the limit parameter", () => {
  const docs = Array.from({ length: 5 }, (_, i) =>
    doc({ documentType: `TYPE_${i}`, uploadedAt: new Date(2026, 0, i + 1) })
  );
  const activity = computeRecentActivity(docs, 2);
  assert.equal(activity.length, 2);
});

// ── computeStorageSummary ─────────────────────────────────────────────────────

test("computeStorageSummary: zero documents → zero totals, null average/largest", () => {
  const summary = computeStorageSummary([]);
  assert.equal(summary.totalBytes, 0);
  assert.equal(summary.averageBytes, null);
  assert.equal(summary.largestDocument, null);
  assert.equal(summary.imageCount, 0);
  assert.equal(summary.pdfCount, 0);
  assert.equal(summary.otherCount, 0);
});

test("computeStorageSummary: classifies mimeType into image/pdf/other buckets", () => {
  const img = doc({ documentType: "GP7", mimeType: "image/jpeg", fileSize: 100 });
  const pdf = doc({ documentType: "NATIONAL_ID", mimeType: "application/pdf", fileSize: 200 });
  const other = doc({ documentType: "PASSPORT", mimeType: "application/msword", fileSize: 300 });
  const summary = computeStorageSummary([img, pdf, other]);
  assert.equal(summary.imageCount, 1);
  assert.equal(summary.pdfCount, 1);
  assert.equal(summary.otherCount, 1);
  assert.equal(summary.totalBytes, 600);
  assert.equal(summary.averageBytes, 200);
});

test("computeStorageSummary: averageBytes only counts documents with a known fileSize", () => {
  const sized = doc({ documentType: "GP7", fileSize: 100 });
  const unsized = doc({ documentType: "NATIONAL_ID", fileSize: null });
  const summary = computeStorageSummary([sized, unsized]);
  assert.equal(summary.averageBytes, 100);
});

// ── computeCategoryRollups ─────────────────────────────────────────────────────

test("computeCategoryRollups: returns one rollup per category, in category order", () => {
  const rollups = computeCategoryRollups([]);
  assert.ok(rollups.length > 0);
  assert.ok(rollups.every((r) => r.documentCount === 0));
});

test("computeCategoryRollups: a document counts toward its own category only", () => {
  const gp7 = doc({ documentType: "GP7", fileSize: 500, uploadedAt: new Date("2026-03-01") });
  const rollups = computeCategoryRollups([gp7]);
  const official = rollups.find((r) => r.categoryCode === "OFFICIAL_PERSONNEL");
  const others = rollups.filter((r) => r.categoryCode !== "OFFICIAL_PERSONNEL");
  assert.equal(official?.documentCount, 1);
  assert.equal(official?.totalBytes, 500);
  assert.ok(others.every((r) => r.documentCount === 0));
});

test("computeCategoryRollups: lastUpdated reflects the most recent uploadedAt in that category", () => {
  const older = doc({ documentType: "GP7", uploadedAt: new Date("2026-01-01") });
  const newer = doc({ documentType: "APPOINTMENT_ORDER", uploadedAt: new Date("2026-06-01") });
  const rollups = computeCategoryRollups([older, newer]);
  const official = rollups.find((r) => r.categoryCode === "OFFICIAL_PERSONNEL");
  assert.equal(official?.lastUpdated?.getTime(), new Date("2026-06-01").getTime());
});
