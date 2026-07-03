/**
 * Quality report assembly + writing (Phase 11B).
 *
 * Ties the QualityEngine and QualityStatistics together into the two output
 * artifacts (quality_report.json, logs/quality_summary.json) and aggregates
 * the top failure reasons and recommendation counts for reporting. The file
 * writer is injected so this stays filesystem-pure and testable. Read-only
 * over the pipeline's data. No globals, no singletons.
 */

import type { KnowledgeBase } from "@/lib/knowledge/knowledge_types";
import { QualityEngine, type OfficerRecord } from "@/lib/quality/quality_engine";
import { buildQualitySummary } from "@/lib/quality/quality_statistics";
import type { QualityReport, QualitySummary } from "@/lib/quality/quality_types";

/** Injectable writer (mirrors the knowledge layer's KnowledgeWriter pattern). */
export interface QualityWriter {
  write(filename: string, data: unknown): void;
}

/** A ranked reason tally, for reporting the most common quality failures/recommendations. */
export interface RankedReason {
  reason: string;
  count: number;
}

export interface QualityAnalysisResult {
  report: QualityReport;
  summary: QualitySummary;
  topFailureReasons: RankedReason[];
  recommendationSummary: RankedReason[];
}

/** Tallies warning messages (by field:message) across all officers, most first. */
function topWarnings(report: QualityReport): RankedReason[] {
  const counts = new Map<string, number>();
  for (const officer of report.officers) {
    for (const warning of officer.warnings) {
      const key = `${warning.field}: ${warning.message}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return rank(counts);
}

/** Tallies recommendation codes across all officers, most first. */
function topRecommendations(report: QualityReport): RankedReason[] {
  const counts = new Map<string, number>();
  for (const officer of report.officers) {
    for (const rec of officer.recommendations) {
      counts.set(rec.code, (counts.get(rec.code) ?? 0) + 1);
    }
  }
  return rank(counts);
}

function rank(counts: Map<string, number>): RankedReason[] {
  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Runs the full quality analysis over the officer records + knowledge base,
 * returning the report, summary, and ranked reason tallies (pure — no I/O).
 */
export function analyzeQuality(
  records: OfficerRecord[],
  base: KnowledgeBase,
  engine: QualityEngine = new QualityEngine()
): QualityAnalysisResult {
  const report = engine.analyze(records, base);
  const summary = buildQualitySummary(report, base);
  return {
    report,
    summary,
    topFailureReasons: topWarnings(report),
    recommendationSummary: topRecommendations(report),
  };
}

/** Writes quality_report.json and knowledge/quality_summary.json via the injected writer. */
export function writeQualityArtifacts(result: QualityAnalysisResult, writer: QualityWriter): void {
  writer.write("quality_report.json", result.report);
  writer.write("quality_summary.json", result.summary);
}
