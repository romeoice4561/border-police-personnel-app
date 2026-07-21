/**
 * Pure dataset → dashboard section composers (Phase 49A.1).
 *
 * Kept free of "server-only" so unit tests can import them directly.
 * Server fetch wrappers live in lib/server/commander_dashboard_service.ts.
 */
import { composeCommanderDashboardViewModel, type DashboardSourceOfficer } from "@/lib/commander_dashboard/view_model";
import type { CommanderDashboardViewModel } from "@/lib/commander_dashboard/types";
import type { CommanderQueryDataset, CommanderQueryOfficer } from "@/lib/commander_query/types";
import {
  computeDocumentReadinessDashboardKpis,
  type DocumentReadinessDashboardKpis,
} from "@/lib/integration/commander/document_readiness_dashboard";

export function toDashboardSourceOfficer(officer: CommanderQueryOfficer): DashboardSourceOfficer {
  const promotion = officer.promotionIntelligence;
  return {
    officerId: officer.officerId,
    displayName: officer.displayName,
    rank: officer.rank,
    currentPosition: officer.currentPosition,
    currentUnit: officer.currentUnit,
    thumbnailUrl: officer.thumbnailUrl,
    officialPortraitUrl: officer.officialPortraitUrl,
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
    positionLevelYearCount: officer.positionLevelYearCount,
    training: officer.trainingIntelligence,
  };
}

/** Pure: Commander Dashboard View Model from an already-loaded dataset. */
export function buildCommanderDashboardViewModelFromDataset(
  dataset: CommanderQueryDataset,
  asOf: Date = new Date()
): CommanderDashboardViewModel {
  return composeCommanderDashboardViewModel(dataset.officers.map(toDashboardSourceOfficer), asOf);
}

/**
 * Pure: Document Readiness KPIs from an already-loaded dataset.
 * Does not re-derive per-officer document intelligence.
 */
export function buildDocumentReadinessDashboardKpisFromDataset(
  dataset: CommanderQueryDataset
): DocumentReadinessDashboardKpis {
  return computeDocumentReadinessDashboardKpis(dataset.officers);
}
