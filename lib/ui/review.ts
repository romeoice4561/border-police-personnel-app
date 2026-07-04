/**
 * Review flagging (Phase 14 UI).
 *
 * Pure functions that derive the review flags Phase 14 asks the Review page to
 * surface — Poor / Fair quality, low confidence, identity incomplete, missing
 * phone / rank / timeline — from an OfficerSummary the API already returns.
 * This does not re-run the Quality Layer; it reads the persisted scores/fields
 * and mirrors the same thresholds (lib/ui/quality) so the UI stays consistent.
 *
 * Read-only over API data. No React, no I/O.
 */

import type { OfficerSummary } from "@/lib/ui/api_client";
import { bandForScore, LOW_CONFIDENCE_THRESHOLD } from "@/lib/ui/quality";

export type ReviewFlag =
  | "poor"
  | "fair"
  | "low_confidence"
  | "identity_incomplete"
  | "missing_phone"
  | "missing_rank"
  | "missing_timeline";

export const REVIEW_FLAG_LABELS: Record<ReviewFlag, string> = {
  poor: "Poor quality",
  fair: "Fair quality",
  low_confidence: "Low confidence",
  identity_incomplete: "Identity incomplete",
  missing_phone: "Missing phone",
  missing_rank: "Missing rank",
  missing_timeline: "Missing timeline",
};

function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim().length === 0;
}

/** Derives the set of review flags for one officer summary. */
export function reviewFlags(officer: OfficerSummary): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  const band = bandForScore(officer.qualityScore).band;

  if (band === "Poor") flags.push("poor");
  else if (band === "Fair") flags.push("fair");

  if (typeof officer.confidence === "number" && officer.confidence <= LOW_CONFIDENCE_THRESHOLD) {
    flags.push("low_confidence");
  }

  // Identity incomplete: missing rank or either name part.
  if (isBlank(officer.rank) || isBlank(officer.firstName) || isBlank(officer.lastName)) {
    flags.push("identity_incomplete");
  }
  if (isBlank(officer.rank)) flags.push("missing_rank");
  if (isBlank(officer.phone)) flags.push("missing_phone");
  // Missing timeline is inferred from a zero-length career (no derivable span).
  if (officer.careerYears <= 0) flags.push("missing_timeline");

  return flags;
}

/** True if an officer needs review (has any flag). */
export function needsReview(officer: OfficerSummary): boolean {
  return reviewFlags(officer).length > 0;
}
