/**
 * Unit tests for the shared resume decision (lib/import/drive_import_resume.ts)
 * used by both scripts/run_batch_import.ts and scripts/run_drive_import.ts.
 * Pure over an injected `exists` predicate — no real filesystem.
 *
 * Run with:
 *   npx tsx --test lib/import/__tests__/drive_import_resume.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  resumeDecision,
  resumePathsFor,
  SKIPPED_MARKER_SUFFIX,
} from "@/lib/import/drive_import_resume";

const EXPORTS = path.join("/exports");

test("resumePathsFor derives the export and skip-marker paths from region + filename", () => {
  const paths = resumePathsFor(EXPORTS, "ภาค1", "officer001.jpg");

  assert.equal(paths.exportPath, path.join(EXPORTS, "ภาค1", "officer001.json"));
  assert.equal(paths.skipMarkerPath, path.join(EXPORTS, "ภาค1", `officer001${SKIPPED_MARKER_SUFFIX}`));
});

test("does not skip when neither the export nor the skip marker exists (fresh image)", () => {
  const paths = resumePathsFor(EXPORTS, "ภาค1", "officer001.jpg");
  const decision = resumeDecision(paths, () => false);

  assert.deepEqual(decision, { skip: false });
});

test("skips with reason already_exported when the export JSON exists", () => {
  const paths = resumePathsFor(EXPORTS, "ภาค1", "officer001.jpg");
  const decision = resumeDecision(paths, (p) => p === paths.exportPath);

  assert.deepEqual(decision, { skip: true, reason: "already_exported" });
});

test("skips with reason classifier_skipped when only the skip marker exists", () => {
  const paths = resumePathsFor(EXPORTS, "ภาค1", "officer001.jpg");
  const decision = resumeDecision(paths, (p) => p === paths.skipMarkerPath);

  assert.deepEqual(decision, { skip: true, reason: "classifier_skipped" });
});

test("export existence takes priority over the classifier marker", () => {
  const paths = resumePathsFor(EXPORTS, "ภาค1", "officer001.jpg");
  // Both exist — the export check must win, matching run_batch_import.ts order.
  const decision = resumeDecision(paths, () => true);

  assert.deepEqual(decision, { skip: true, reason: "already_exported" });
});

test("resume decision is independent of file extension (png resolves to the same .json export)", () => {
  const jpg = resumePathsFor(EXPORTS, "ภาค2", "abc.jpg");
  const png = resumePathsFor(EXPORTS, "ภาค2", "abc.png");

  assert.equal(jpg.exportPath, png.exportPath);
});
