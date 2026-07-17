import { CommanderQueryCenter } from "@/components/commander/query/commander_query_center";
import { TranslatedPageHeader } from "@/components/common/translated_page_header";
import { getCommanderQueryDataset } from "@/lib/server/commander_query_service";
import type { CommanderQueryFilters } from "@/components/commander/query/types";
import type { PromotionEligibilityStatus } from "@/lib/intelligence/shared/types";

export const dynamic = "force-dynamic";

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

const RETIREMENT_WITHIN_VALUES = ["within-1-year", "within-3-years", "within-5-years"] as const;

/**
 * Phase 42: seeds Commander Search's filter state from a shareable URL —
 * e.g. a Commander Dashboard drill-down link
 * (`/commander-search?promotionEligibilityStatus=AlreadyEligible`). Only
 * the specific params Dashboard actually links to are recognized; an
 * unrecognized/malformed value is silently ignored (never crashes the
 * page) rather than producing a confusing partial filter.
 */
function filtersFromSearchParams(params: Record<string, string | string[] | undefined>): CommanderQueryFilters {
  const filters: CommanderQueryFilters = {};

  const promotionEligibilityStatus = params.promotionEligibilityStatus;
  if (typeof promotionEligibilityStatus === "string" && (PROMOTION_ELIGIBILITY_STATUSES as readonly string[]).includes(promotionEligibilityStatus)) {
    filters.promotionEligibilityStatus = promotionEligibilityStatus as PromotionEligibilityStatus;
  }

  const retirementWithin = params.retirement;
  if (typeof retirementWithin === "string" && (RETIREMENT_WITHIN_VALUES as readonly string[]).includes(retirementWithin)) {
    filters.retirementWithin = retirementWithin as (typeof RETIREMENT_WITHIN_VALUES)[number];
  }

  return filters;
}

export default async function CommanderSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [dataset, resolvedSearchParams] = await Promise.all([getCommanderQueryDataset(), searchParams]);
  const initialFilters = filtersFromSearchParams(resolvedSearchParams);

  return (
    <div className="space-y-6">
      {/* Phase 43: title/description are translated client-side; the language
          switch is the single global one in the app shell (no page toggle). */}
      <TranslatedPageHeader titleKey="commander.title" descriptionKey="commander.subtitle" />
      <CommanderQueryCenter dataset={dataset} initialFilters={initialFilters} />
    </div>
  );
}
