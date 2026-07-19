/**
 * Commander Intelligence display-copy mapping (Phase 45.2).
 *
 * Maps the Intelligence engine's STABLE status/priority/flag/topic codes to
 * TranslationKey values — the engine's own calculation (promotionStatus,
 * retirementStatus, priority, profileCompleteness band, flags, severity) is
 * never touched here; this module only decides which dictionary key
 * displays a given code, through ONE lookup table per code family (per the
 * "one formatter/dictionary" requirement — no ad-hoc string matching
 * scattered across components).
 *
 * Recommendation strings from generateRecommendations() (lib/intelligence/
 * recommendations.ts) are already deduplicated by TOPIC there; this module
 * maps the small set of KNOWN recommendation strings back to a
 * TranslationKey so they render in the active language. A recommendation
 * string that doesn't match any known entry (e.g. a document-specific
 * "Complete <label>." built from a free-text requirement.label, which has
 * no finite key space) passes through unchanged — never blocking display,
 * never silently dropped.
 *
 * Pure — no I/O, no React.
 */
import type { CompletenessStatus, OfficerFlagCode, OfficerPriority, PromotionStatus, RetirementStatus } from "@/lib/intelligence/types";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export const PROMOTION_STATUS_KEY: Record<PromotionStatus, TranslationKey> = {
  eligible: "commander.intelligence.promotionStatus.eligible",
  near_eligible: "commander.intelligence.promotionStatus.near_eligible",
  not_eligible: "commander.intelligence.promotionStatus.not_eligible",
  unknown: "commander.intelligence.promotionStatus.unknown",
};

export const RETIREMENT_STATUS_KEY: Record<RetirementStatus, TranslationKey> = {
  normal: "commander.intelligence.retirementStatus.normal",
  retiring_within_2_years: "commander.intelligence.retirementStatus.retiring_within_2_years",
  retiring_within_1_year: "commander.intelligence.retirementStatus.retiring_within_1_year",
  retired: "commander.intelligence.retirementStatus.retired",
  unknown: "commander.intelligence.retirementStatus.unknown",
};

export const PRIORITY_KEY: Record<OfficerPriority, TranslationKey> = {
  low: "commander.intelligence.priority.low",
  medium: "commander.intelligence.priority.medium",
  high: "commander.intelligence.priority.high",
  critical: "commander.intelligence.priority.critical",
};

export const COMPLETENESS_BAND_KEY: Record<CompletenessStatus, TranslationKey> = {
  high: "commander.intelligence.completenessBand.high",
  medium: "commander.intelligence.completenessBand.medium",
  low: "commander.intelligence.completenessBand.low",
  unknown: "commander.intelligence.completenessBand.unknown",
};

export const FLAG_KEY: Record<OfficerFlagCode, TranslationKey> = {
  PROMOTION_READY: "commander.intelligence.flag.PROMOTION_READY",
  NEAR_PROMOTION: "commander.intelligence.flag.NEAR_PROMOTION",
  RETIRING_SOON: "commander.intelligence.flag.RETIRING_SOON",
  NEEDS_TRAINING: "commander.intelligence.flag.NEEDS_TRAINING",
  DOCUMENTS_MISSING: "commander.intelligence.flag.DOCUMENTS_MISSING",
  PROFILE_INCOMPLETE: "commander.intelligence.flag.PROFILE_INCOMPLETE",
  MISSING_OFFICIAL_PORTRAIT: "commander.intelligence.flag.MISSING_OFFICIAL_PORTRAIT",
};

/**
 * The exact English strings generateRecommendations() can emit for a
 * closed-set topic (flags, training, GP7) — matched verbatim to their
 * TranslationKey. A generic document recommendation ("Complete <label>.")
 * has no finite key space and is intentionally NOT in this table; callers
 * must fall back to the raw string for those (see
 * translateRecommendation's return contract).
 */
const RECOMMENDATION_KEY_BY_ENGLISH: Record<string, TranslationKey> = {
  "Officer is ready for promotion review.": "commander.intelligence.recommendation.PROMOTION_READY",
  "Review remaining promotion gaps and prepare the officer for the next cycle.": "commander.intelligence.recommendation.NEAR_PROMOTION",
  "Retirement planning should begin.": "commander.intelligence.recommendation.RETIRING_SOON",
  "Complete required training.": "commander.intelligence.recommendation.training",
  "Complete missing promotion documents.": "commander.intelligence.recommendation.DOCUMENTS_MISSING",
  "Update incomplete profile information.": "commander.intelligence.recommendation.PROFILE_INCOMPLETE",
  "Replace missing official portrait.": "commander.intelligence.recommendation.MISSING_OFFICIAL_PORTRAIT",
  "Complete GP7.": "commander.intelligence.recommendation.document:gp7",
};

/** Returns the TranslationKey for a known recommendation string, or null when it's a free-text document recommendation with no finite key (caller renders the raw string in that case — never dropped, never English-in-Thai-mode by silent omission since the engine only ever emits English here today). */
export function translationKeyForRecommendation(recommendation: string): TranslationKey | null {
  return RECOMMENDATION_KEY_BY_ENGLISH[recommendation] ?? null;
}
