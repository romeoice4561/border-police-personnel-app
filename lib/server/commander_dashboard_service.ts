/**
 * Commander Dashboard server data service (Phase 42 — Commander Dashboard
 * Intelligence; Phase 42 UI refinement adds Official Portrait resolution).
 *
 * Loads the SAME dataset Commander Search already computes
 * (`getCommanderQueryDataset()` — includes `promotionIntelligence:
 * PromotionSummary` and `displayServiceDurationTh`/`retirementYearBe` per
 * officer) and composes it into the Commander Dashboard View Model via the
 * pure functions in lib/commander_dashboard/view_model.ts. This service
 * does not calculate promotion eligibility, age, retirement, service, or
 * fiscal-year logic itself — those all come from the Intelligence Engine
 * facades upstream (Promotion/Service/Retirement Intelligence). The one
 * NEW piece of I/O this refinement adds is batch-resolving each officer's
 * Official Portrait via `resolveOfficerPortraitsBatch` — the ONE sanctioned
 * portrait resolver in the codebase (lib/server/officer_portrait_service.ts)
 * — so the Promotion Priority list shows the real Official Portrait,
 * never a gallery thumbnail.
 */
import "server-only";
import { getCommanderQueryDataset } from "@/lib/server/commander_query_service";
import { resolveOfficerPortraitsBatch } from "@/lib/server/officer_portrait_service";
import { composeCommanderDashboardViewModel, type DashboardSourceOfficer } from "@/lib/commander_dashboard/view_model";
import type { CommanderDashboardViewModel } from "@/lib/commander_dashboard/types";
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";

function toSourceOfficer(officer: CommanderQueryOfficer, officialPortraitUrl: string | null): DashboardSourceOfficer {
  const promotion = officer.promotionIntelligence;
  return {
    officerId: officer.officerId,
    displayName: officer.displayName,
    rank: officer.rank,
    currentPosition: officer.currentPosition,
    currentUnit: officer.currentUnit,
    thumbnailUrl: officer.thumbnailUrl,
    officialPortraitUrl,
    dateOfBirth: officer.dateOfBirth,
    promotionStatus: promotion.promotionStatus,
    displayStatusTh: promotion.displayStatusTh ?? "",
    displayEligibleSinceTh: promotion.displayEligibleSinceTh,
    eligibleDate: promotion.eligibleDate,
    eligibleFiscalYearBe: promotion.eligibleFiscalYearBe,
    yearsEligible: promotion.yearsEligible,
    monthsEligible: promotion.monthsEligible,
    daysEligible: promotion.daysEligible,
    overdueYears: promotion.overdueYears,
    promotionCyclesPassed: promotion.promotionCyclesPassed,
    priority: promotion.priority,
    priorityReason: promotion.priorityReason,
    displayServiceDurationTh: officer.displayServiceDurationTh,
    retirementYearBe: officer.retirementYearBe,
    targetPosition: promotion.targetPosition,
    yearsInPositionLevel: officer.yearsInPositionLevel,
  };
}

/**
 * Builds the full Commander Dashboard View Model from live data. `asOf`
 * defaults to now; the Dashboard page always calls this with no argument —
 * tests call `composeCommanderDashboardViewModel` directly with a fixed
 * `asOf` instead of going through this Prisma-backed entry point.
 */
export async function getCommanderDashboardViewModel(): Promise<CommanderDashboardViewModel> {
  const asOf = new Date();
  const dataset = await getCommanderQueryDataset();
  const portraits = await resolveOfficerPortraitsBatch(dataset.officers.map((officer) => officer.officerId));
  const sourceOfficers = dataset.officers.map((officer) =>
    toSourceOfficer(officer, portraits.get(officer.officerId)?.thumbnailUrl ?? null)
  );
  return composeCommanderDashboardViewModel(sourceOfficers, asOf);
}
