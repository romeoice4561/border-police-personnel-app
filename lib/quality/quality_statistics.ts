/**
 * Quality statistics (Phase 11B): the logs/quality_summary.json aggregate.
 *
 * Pure aggregation over the per-officer QualityReport plus the KnowledgeBase
 * (for duplicate counts). Read-only. No globals, no I/O.
 */

import type { KnowledgeBase } from "@/lib/knowledge/knowledge_types";
import { detectDuplicates } from "@/lib/knowledge/knowledge_statistics";
import type { OfficerQuality, QualityReport, QualitySummary } from "@/lib/quality/quality_types";

function round(value: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

/** Counts officers whose scored field is missing. */
function countMissing(officers: OfficerQuality[], field: string): number {
  return officers.filter((o) => o.missing_fields.includes(field as OfficerQuality["missing_fields"][number])).length;
}

/**
 * Builds the quality summary. Duplicate counts come from the KnowledgeBase's
 * own detection (reused, not recomputed). `duplicate_records` is the total
 * number of duplicate groups across phone + identity.
 */
export function buildQualitySummary(report: QualityReport, base: KnowledgeBase): QualitySummary {
  const officers = report.officers;
  const total = officers.length;

  const excellent = officers.filter((o) => o.category === "Excellent").length;
  const good = officers.filter((o) => o.category === "Good").length;
  const fair = officers.filter((o) => o.category === "Fair").length;
  const poor = officers.filter((o) => o.category === "Poor").length;

  const qualitySum = officers.reduce((sum, o) => sum + o.quality_score, 0);

  const duplicates = detectDuplicates(base);

  // "missing_name" = officer missing either first or last name.
  const missingName = officers.filter(
    (o) => o.missing_fields.includes("first_name") || o.missing_fields.includes("last_name")
  ).length;

  return {
    total_officers: total,
    excellent,
    good,
    fair,
    poor,
    average_quality: total > 0 ? round(qualitySum / total) : 0,
    missing_rank: countMissing(officers, "rank"),
    missing_name: missingName,
    missing_position: countMissing(officers, "position"),
    missing_unit: countMissing(officers, "unit"),
    missing_phone: countMissing(officers, "phone"),
    missing_timeline: countMissing(officers, "timeline"),
    duplicate_records: duplicates.duplicate_phones.length + duplicates.duplicate_officers.length,
    duplicate_phone: duplicates.duplicate_phones.length,
    duplicate_names: duplicates.duplicate_officers.length,
  };
}
