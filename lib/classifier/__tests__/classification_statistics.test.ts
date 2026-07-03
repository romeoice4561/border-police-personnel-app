import { test } from "node:test";
import assert from "node:assert/strict";
import { DefaultClassificationStatisticsBuilder } from "@/lib/classifier/classification_statistics";
import type { ImageClassificationResult } from "@/lib/classifier/classification_types";

function result(category: ImageClassificationResult["category"], shouldProcess: boolean): ImageClassificationResult {
  return { category, confidence: 90, reason: "test", shouldProcess };
}

test("counts total, processed, and skipped images correctly", () => {
  const builder = new DefaultClassificationStatisticsBuilder();
  builder.add(result("PERSONNEL_PROFILE", true));
  builder.add(result("TIMELINE", false));
  builder.add(result("ORGANIZATION_CHART", false));

  const summary = builder.build();
  assert.equal(summary.total_images, 3);
  assert.equal(summary.processed_images, 1);
  assert.equal(summary.skipped_images, 2);
});

test("tallies each category into its dedicated field", () => {
  const builder = new DefaultClassificationStatisticsBuilder();
  builder.add(result("PERSONNEL_PROFILE", true));
  builder.add(result("PERSONNEL_PROFILE", true));
  builder.add(result("TIMELINE", false));
  builder.add(result("ORGANIZATION_CHART", false));
  builder.add(result("COVER_PAGE", false));
  builder.add(result("TITLE_PAGE", false));
  builder.add(result("TABLE", false));
  builder.add(result("MAP", false));
  builder.add(result("DIAGRAM", false));
  builder.add(result("INDEX_PAGE", false));
  builder.add(result("UNKNOWN", false));

  const summary = builder.build();
  assert.equal(summary.personnel_profiles, 2);
  assert.equal(summary.timelines, 1);
  assert.equal(summary.organization_charts, 1);
  assert.equal(summary.cover_pages, 1);
  assert.equal(summary.title_pages, 1);
  assert.equal(summary.tables, 1);
  assert.equal(summary.maps, 1);
  assert.equal(summary.diagrams, 1);
  assert.equal(summary.index_pages, 1);
  assert.equal(summary.unknown, 1);
});

test("estimated_api_calls_saved equals the number of skipped images", () => {
  const builder = new DefaultClassificationStatisticsBuilder();
  builder.add(result("PERSONNEL_PROFILE", true));
  builder.add(result("TIMELINE", false));
  builder.add(result("TIMELINE", false));

  const summary = builder.build();
  assert.equal(summary.estimated_api_calls_saved, 2);
});

test("estimated cost and time saved use the injected assumptions", () => {
  const builder = new DefaultClassificationStatisticsBuilder({
    estimatedCostPerCallUsd: 0.02,
    estimatedProcessingSecondsPerCall: 10,
  });
  builder.add(result("TIMELINE", false));
  builder.add(result("TIMELINE", false));

  const summary = builder.build();
  assert.equal(summary.estimated_cost_saved_usd, 0.04);
  assert.equal(summary.estimated_processing_time_saved_seconds, 20);
});

test("empty result set produces a zeroed summary", () => {
  const builder = new DefaultClassificationStatisticsBuilder();
  const summary = builder.build();

  assert.equal(summary.total_images, 0);
  assert.equal(summary.processed_images, 0);
  assert.equal(summary.skipped_images, 0);
  assert.equal(summary.estimated_api_calls_saved, 0);
  assert.equal(summary.estimated_cost_saved_usd, 0);
  assert.equal(summary.estimated_processing_time_saved_seconds, 0);
});
