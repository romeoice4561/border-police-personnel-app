/**
 * Quality rules (Phase 11B): warnings and recommendations.
 *
 * Pure rule functions that turn a record's completeness/timeline/duplicate
 * findings into read-only warnings and actionable recommendations. A
 * recommendation is advice for a human reviewer (e.g. "re-scan this image") —
 * it NEVER mutates data and this layer never acts on it.
 *
 * No globals, no I/O.
 */

import type { PersonnelExtraction } from "@/lib/types/vision";
import type { QualityRecommendation, QualityWarning } from "@/lib/quality/quality_types";
import type { TimelineQualityFindings } from "@/lib/quality/timeline_quality";
import { missingFields } from "@/lib/quality/field_completeness";

/** Confidence at or below this is flagged as low OCR/extraction confidence. */
const LOW_CONFIDENCE_THRESHOLD = 60;

export interface RuleContext {
  extraction: PersonnelExtraction;
  timeline: TimelineQualityFindings;
  inDuplicatePhoneGroup: boolean;
  inDuplicateOfficerGroup: boolean;
  inDuplicateTimelineGroup: boolean;
}

/** Builds the non-fatal warnings for a record. */
export function buildWarnings(context: RuleContext): QualityWarning[] {
  const { extraction, timeline } = context;
  const warnings: QualityWarning[] = [];

  for (const field of missingFields(extraction)) {
    warnings.push({ field, message: `${field} is missing or empty` });
  }

  if (timeline.entryCount > 0) {
    if (timeline.missingYear > 0) warnings.push({ field: "timeline", message: `${timeline.missingYear} timeline entr(ies) missing a year` });
    if (timeline.emptyRows > 0) warnings.push({ field: "timeline", message: `${timeline.emptyRows} empty timeline row(s)` });
    if (timeline.duplicateEntries > 0) warnings.push({ field: "timeline", message: `${timeline.duplicateEntries} duplicate timeline entr(ies)` });
    if (timeline.outOfOrder) warnings.push({ field: "timeline", message: "timeline is not ordered newest → oldest" });
  }

  if (typeof extraction.confidence === "number" && extraction.confidence <= LOW_CONFIDENCE_THRESHOLD) {
    warnings.push({ field: "confidence", message: `low extraction confidence (${extraction.confidence})` });
  }

  if (context.inDuplicatePhoneGroup) warnings.push({ field: "phone", message: "phone is shared with another officer record" });
  if (context.inDuplicateOfficerGroup) warnings.push({ field: "identity", message: "rank + name matches another officer record" });
  if (context.inDuplicateTimelineGroup) warnings.push({ field: "timeline", message: "a timeline entry is shared with another officer record" });

  return warnings;
}

/** Builds actionable, read-only recommendations for a record. */
export function buildRecommendations(context: RuleContext): QualityRecommendation[] {
  const { extraction, timeline } = context;
  const recommendations: QualityRecommendation[] = [];

  const missing = new Set(missingFields(extraction));

  if (missing.has("rank") || missing.has("first_name") || missing.has("last_name")) {
    recommendations.push({ code: "IDENTITY_INCOMPLETE", message: "Identity incomplete — re-review the source image for rank/name." });
  }
  if (missing.has("position") || missing.has("unit")) {
    recommendations.push({ code: "POSTING_INCOMPLETE", message: "Position/unit missing — verify the officer's current posting on the source." });
  }
  if (missing.has("phone")) {
    recommendations.push({ code: "MISSING_PHONE", message: "Phone missing — check the source image for a contact number." });
  }
  if (timeline.entryCount === 0) {
    recommendations.push({ code: "MISSING_TIMELINE", message: "No career timeline — re-scan; the source may include a service history table." });
  } else if (timeline.missingYear > 0 || timeline.emptyRows > 0) {
    recommendations.push({ code: "TIMELINE_INCOMPLETE", message: "Timeline incomplete — some entries lack a year or are empty." });
  }
  if (typeof extraction.confidence === "number" && extraction.confidence <= LOW_CONFIDENCE_THRESHOLD) {
    recommendations.push({ code: "LOW_CONFIDENCE", message: "Low OCR/extraction confidence — prioritize this record for human review." });
  }
  if (context.inDuplicatePhoneGroup || context.inDuplicateOfficerGroup) {
    recommendations.push({ code: "POSSIBLE_DUPLICATE", message: "Possible duplicate record — compare with the matching officer before use." });
  }

  return recommendations;
}
