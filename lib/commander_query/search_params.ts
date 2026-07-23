/**
 * Commander Search URL query-string filter parsing (Phase 42; extracted
 * Phase 45 completion pass, Task 14 item 16, so it can be unit-tested
 * without pulling in app/commander-search/page.tsx's server-only
 * getCommanderQueryDataset import).
 *
 * Seeds Commander Search's filter state from a shareable URL — e.g. a
 * Commander Dashboard / Intelligence Center drill-down link
 * (`/commander-search?promotionEligibilityStatus=AlreadyEligible`,
 * `/commander-search?trainingStatus=MissingRequired`,
 * `/commander-search?priority=critical`). Only the specific params those
 * surfaces actually link to are recognized; an unrecognized/malformed
 * value is silently ignored (never crashes the page) rather than
 * producing a confusing partial filter.
 *
 * Pure — no I/O, no React.
 */
import type { CommanderQueryFilters } from "@/components/commander/query/types";
import type { OfficerFlagCode, OfficerPriority } from "@/lib/intelligence/types";
import type { PromotionEligibilityStatus } from "@/lib/intelligence/shared/types";
import type { TrainingStatus } from "@/lib/intelligence/training/types";
import { parseCommanderDocumentFilters } from "@/lib/integration/navigation/drilldown_contract";

const PROMOTION_ELIGIBILITY_STATUSES: readonly PromotionEligibilityStatus[] = [
  "EligibleThisYear",
  "AlreadyEligible",
  "Waiting",
  "MissingTraining",
  "MissingDocuments",
  "RetirementRestricted",
  "NotEligible",
  "Unknown",
];

/** Every real, reliably-computable TrainingStatus value — none is fabricated (see lib/intelligence/training/types.ts). */
const TRAINING_STATUSES: readonly TrainingStatus[] = [
  "Complete",
  "MissingRequired",
  "ExpiringSoon",
  "Expired",
  "Unverified",
  "NoPolicy",
  "NoData",
  "Unknown",
];

const RETIREMENT_WITHIN_VALUES = ["within-1-year", "within-3-years", "within-5-years"] as const;

const OFFICER_PRIORITIES: readonly OfficerPriority[] = ["low", "medium", "high", "critical"];

const OFFICER_FLAG_CODES: readonly OfficerFlagCode[] = [
  "PROMOTION_READY",
  "NEAR_PROMOTION",
  "RETIRING_SOON",
  "NEEDS_TRAINING",
  "DOCUMENTS_MISSING",
  "PROFILE_INCOMPLETE",
  "MISSING_OFFICIAL_PORTRAIT",
];

function isTruthyQueryFlag(value: string | string[] | undefined): boolean {
  return typeof value === "string" && (value === "true" || value === "1");
}

export function filtersFromSearchParams(params: Record<string, string | string[] | undefined>): CommanderQueryFilters {
  // Phase 49A: document-intelligence filters are parsed by their own
  // dedicated module (one canonical parser, reused by both this function
  // and any other future URL-seeding entry point) — merged in first so the
  // existing fields below can still be added/overridden exactly as before.
  const filters: CommanderQueryFilters = { ...parseCommanderDocumentFilters(params) };

  const promotionEligibilityStatus = params.promotionEligibilityStatus;
  if (typeof promotionEligibilityStatus === "string" && (PROMOTION_ELIGIBILITY_STATUSES as readonly string[]).includes(promotionEligibilityStatus)) {
    filters.promotionEligibilityStatus = promotionEligibilityStatus as PromotionEligibilityStatus;
  }

  const retirementWithin = params.retirement;
  if (typeof retirementWithin === "string" && (RETIREMENT_WITHIN_VALUES as readonly string[]).includes(retirementWithin)) {
    filters.retirementWithin = retirementWithin as (typeof RETIREMENT_WITHIN_VALUES)[number];
  }

  const trainingStatus = params.trainingStatus;
  if (typeof trainingStatus === "string" && (TRAINING_STATUSES as readonly string[]).includes(trainingStatus)) {
    filters.trainingStatus = trainingStatus as TrainingStatus;
  }

  // Phase 49B: Intelligence Center KPI / priority-matrix drill-downs seed
  // these already-supported CommanderQueryFilters fields. They were always
  // applied client-side; parsing them from the URL makes hard-reload /
  // bookmark / share reproducible.
  if (isTruthyQueryFlag(params.readyForPromotion)) {
    filters.readyForPromotion = true;
  }

  const flagCode = params.flagCode;
  if (typeof flagCode === "string" && (OFFICER_FLAG_CODES as readonly string[]).includes(flagCode)) {
    filters.flagCode = flagCode as OfficerFlagCode;
  }

  const priority = params.priority;
  if (typeof priority === "string" && (OFFICER_PRIORITIES as readonly string[]).includes(priority)) {
    filters.priority = priority as OfficerPriority;
  }

  return filters;
}
