/**
 * Commander Intelligence Center — pure view-model composition (Phase 49B).
 *
 * Consumes the SAME already-built CommanderQueryDataset + CommanderDashboard
 * + CommanderDashboardViewModel that Commander Dashboard/Search already
 * compose (see lib/commander_dashboard/orchestrate_page_data.ts) and derives
 * KPIs / Priority Matrix / Action Center / Timeline / Executive Table /
 * Executive Summary from them — zero new business rules, zero re-derivation
 * of promotion/retirement/training/document intelligence. Every count here
 * is either read directly from an existing field or is a simple bucket/tally
 * over already-computed per-officer values.
 *
 * Pure — no I/O, no React, no database.
 */
import type { CommanderQueryDataset, CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { CommanderDashboard } from "@/lib/intelligence";
import type { CommanderDashboardViewModel } from "@/lib/commander_dashboard/types";
import { buildOfficerProfileUrl, buildOfficerEpfUrl, buildCommanderDocumentFilterUrl } from "@/lib/integration/navigation/drilldown_contract";
import { computeAgeSummary } from "@/lib/intelligence/age";
import { computeRetirementSummary } from "@/lib/intelligence/retirement";
import { computeExpiryInfo, groupByTimelineBucket, type TimelineBucketKey } from "@/lib/document/document_expiry";
import { getDocumentTypeLabel } from "@/lib/document/document_type_labels";
import type {
  CommanderIntelligenceCenterViewModel,
  CommanderKpiCardViewModel,
  CommanderTimelineBucket,
  CommanderTimelineEvent,
  CommanderTimelineHorizon,
  ExecutiveSummaryViewModel,
  ExecutiveTableRow,
  PriorityBucketKey,
  PriorityMatrixBucket,
} from "@/lib/commander_intelligence_center/types";
import { PRIORITY_BUCKET_ORDER } from "@/lib/commander_intelligence_center/types";

export interface BuildCommanderIntelligenceCenterInput {
  dataset: CommanderQueryDataset;
  dashboard: CommanderDashboard;
  viewModel: CommanderDashboardViewModel;
  asOf: Date;
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

function buildKpis(
  officers: readonly CommanderQueryOfficer[],
  dashboard: CommanderDashboard,
  viewModel: CommanderDashboardViewModel
): CommanderKpiCardViewModel[] {
  const promotionReady = viewModel.promotion.eligibleThisYear + viewModel.promotion.alreadyEligible;
  const promotionOverdue = officers.filter((o) => o.promotionIntelligence.overdueYears != null && o.promotionIntelligence.overdueYears > 0).length;
  const documentsMissing = officers.filter((o) => o.documentIntelligence.missingRequiredCount > 0).length;
  const trainingMissing = viewModel.training.missingRequiredCount;
  const profileIncomplete = dashboard.summary.incompleteProfiles;
  const expiredDocuments = officers.filter((o) => o.documentIntelligence.expiredCount > 0).length;
  const criticalOfficers = dashboard.officers.filter((o) => o.priority === "critical").length;
  const aiReady = officers.filter((o) => o.documentIntelligence.readinessLevel === "READY").length;

  return [
    { id: "personnel", value: officers.length, href: "/commander-search" },
    { id: "readyForPromotion", value: promotionReady, href: "/commander-search?readyForPromotion=true" },
    { id: "promotionOverdue", value: promotionOverdue, href: "/commander-search?promotionEligibilityStatus=AlreadyEligible" },
    { id: "retiringWithin12Months", value: viewModel.retirement.withinOneYear, href: "/commander-search?retirement=within-1-year" },
    { id: "documentsMissing", value: documentsMissing, href: buildCommanderDocumentFilterUrl({ missingRequiredDocument: true }) },
    {
      id: "trainingMissing",
      value: trainingMissing,
      href: viewModel.training.policyConfigured ? "/commander-search?trainingStatus=MissingRequired" : null,
    },
    { id: "profileIncomplete", value: profileIncomplete, href: "/commander-search?flagCode=PROFILE_INCOMPLETE" },
    { id: "expiredDocuments", value: expiredDocuments, href: buildCommanderDocumentFilterUrl({ expiryStatus: "expired" }) },
    { id: "criticalOfficers", value: criticalOfficers, href: "/commander-search?priority=critical" },
    { id: "aiReady", value: aiReady, href: buildCommanderDocumentFilterUrl({ documentReadiness: "READY" }) },
  ];
}

// ---------------------------------------------------------------------------
// Priority Matrix
// ---------------------------------------------------------------------------

function buildPriorityMatrix(dashboard: CommanderDashboard): PriorityMatrixBucket[] {
  const byPriority = new Map<PriorityBucketKey, PriorityMatrixBucket>();
  for (const key of PRIORITY_BUCKET_ORDER) {
    byPriority.set(key, { key, count: 0, href: `/commander-search?priority=${key}`, officers: [] });
  }

  for (const card of dashboard.officers) {
    const bucket = byPriority.get(card.priority);
    if (!bucket) continue;
    bucket.count += 1;
    if (bucket.officers.length < 10) {
      bucket.officers.push({
        officerId: card.officerId,
        displayName: card.displayName,
        rank: null,
        flagCodes: card.flags.map((f) => f.code),
        href: buildOfficerProfileUrl(card.officerId),
      });
    }
  }

  return PRIORITY_BUCKET_ORDER.map((key) => byPriority.get(key)!);
}

// ---------------------------------------------------------------------------
// Action Center
// ---------------------------------------------------------------------------

function buildActionCenter(
  officers: readonly CommanderQueryOfficer[],
  dashboard: CommanderDashboard,
  viewModel: CommanderDashboardViewModel
) {
  const promotionCandidates = viewModel.promotion.eligibleThisYear + viewModel.promotion.alreadyEligible;
  const missingDocuments = officers.filter((o) => o.documentIntelligence.missingRequiredCount > 0).length;
  const expiringIds = officers.filter((o) => o.documentIntelligence.expiringSoonCount > 0).length;
  const missingTraining = viewModel.training.missingRequiredCount;
  const incompleteProfiles = dashboard.summary.incompleteProfiles;

  return [
    {
      id: "approvePromotionCandidates" as const,
      count: promotionCandidates,
      href: promotionCandidates > 0 ? "/commander-search?readyForPromotion=true" : null,
    },
    {
      id: "reviewMissingDocuments" as const,
      count: missingDocuments,
      href: missingDocuments > 0 ? buildCommanderDocumentFilterUrl({ missingRequiredDocument: true }) : null,
    },
    {
      id: "reviewExpiringIds" as const,
      count: expiringIds,
      href: expiringIds > 0 ? buildCommanderDocumentFilterUrl({ expiryStatus: "warning" }) : null,
    },
    {
      id: "reviewMissingTraining" as const,
      count: missingTraining,
      href: missingTraining > 0 && viewModel.training.policyConfigured ? "/commander-search?trainingStatus=MissingRequired" : null,
    },
    {
      id: "reviewIncompleteProfiles" as const,
      count: incompleteProfiles,
      href: incompleteProfiles > 0 ? "/commander-search?flagCode=PROFILE_INCOMPLETE" : null,
    },
  ];
}

// ---------------------------------------------------------------------------
// Commander Timeline (30 / 60 / 90 days)
// ---------------------------------------------------------------------------

const TIMELINE_HORIZONS: readonly CommanderTimelineHorizon[] = [30, 60, 90];

function docExpiryBucketToHorizon(key: TimelineBucketKey): CommanderTimelineHorizon | null {
  if (key === "next30" || key === "expired") return 30;
  if (key === "next60") return 60;
  if (key === "next90") return 90;
  return null;
}

function horizonForDays(daysUntil: number): CommanderTimelineHorizon | null {
  if (daysUntil <= 30) return 30;
  if (daysUntil <= 60) return 60;
  if (daysUntil <= 90) return 90;
  return null;
}

/** Builds the Commander Timeline: birthdays, retirement, promotion eligibility, document expiry, training expiry — each bucketed into the next 30/60/90-day window, all sourced from already-computed engine outputs. */
function buildTimeline(officers: readonly CommanderQueryOfficer[], asOf: Date): CommanderTimelineBucket[] {
  const eventsByHorizon: Record<CommanderTimelineHorizon, CommanderTimelineEvent[]> = { 30: [], 60: [], 90: [] };

  for (const officer of officers) {
    // Birthdays.
    if (officer.dateOfBirth) {
      const age = computeAgeSummary(officer.dateOfBirth, asOf);
      if (age.available && age.daysUntilNextBirthday != null) {
        const horizon = horizonForDays(age.daysUntilNextBirthday);
        if (horizon) {
          eventsByHorizon[horizon].push({
            kind: "birthday",
            officerId: officer.officerId,
            displayName: officer.displayName,
            daysUntil: age.daysUntilNextBirthday,
            detailTh: age.nextBirthdayAge != null ? `ครบ ${age.nextBirthdayAge} ปี` : "",
            href: buildOfficerProfileUrl(officer.officerId),
          });
        }
      }

      // Retirement.
      const retirement = computeRetirementSummary(officer.dateOfBirth, asOf);
      if (retirement.available && !retirement.isRetired && retirement.remainingDays != null) {
        const horizon = horizonForDays(retirement.remainingDays);
        if (horizon) {
          eventsByHorizon[horizon].push({
            kind: "retirement",
            officerId: officer.officerId,
            displayName: officer.displayName,
            daysUntil: retirement.remainingDays,
            detailTh: retirement.displayRetirementDateTh ?? "",
            href: buildOfficerProfileUrl(officer.officerId),
          });
        }
      }
    }

    // Promotion eligibility (uses the same fiscal-year-start date the Promotion Priority list already displays).
    const promotion = officer.promotionIntelligence;
    if (promotion.eligibleDate) {
      const eligibleAt = new Date(promotion.eligibleDate);
      const daysUntil = Math.round((eligibleAt.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil >= 0) {
        const horizon = horizonForDays(daysUntil);
        if (horizon) {
          eventsByHorizon[horizon].push({
            kind: "promotionEligibility",
            officerId: officer.officerId,
            displayName: officer.displayName,
            daysUntil,
            detailTh: promotion.displayStatusTh ?? "",
            href: buildOfficerProfileUrl(officer.officerId),
          });
        }
      }
    }

    // Document expiry — reuses document_expiry.ts's own bucketer.
    const expiryInfo = computeExpiryInfo(officer.documentExpiryInfo.map((i) => i.document), asOf);
    for (const bucket of groupByTimelineBucket(expiryInfo)) {
      const horizon = docExpiryBucketToHorizon(bucket.key);
      if (!horizon) continue;
      for (const item of bucket.items) {
        eventsByHorizon[horizon].push({
          kind: "documentExpiry",
          officerId: officer.officerId,
          displayName: officer.displayName,
          daysUntil: Math.max(0, item.daysRemaining ?? 0),
          detailTh: getDocumentTypeLabel(item.document.documentType, "th"),
          href: buildOfficerEpfUrl(officer.officerId),
        });
      }
    }
  }

  return TIMELINE_HORIZONS.map((horizon) => ({
    horizon,
    events: eventsByHorizon[horizon].sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 25),
  })).filter((bucket) => bucket.events.length > 0);
}

// ---------------------------------------------------------------------------
// Executive Table
// ---------------------------------------------------------------------------

function buildExecutiveTable(officers: readonly CommanderQueryOfficer[], dashboard: CommanderDashboard): ExecutiveTableRow[] {
  const priorityByOfficerId = new Map(dashboard.officers.map((card) => [card.officerId, card.priority]));

  return officers.map((officer) => ({
    officerId: officer.officerId,
    officialPortraitUrl: officer.officialPortraitUrl,
    rank: officer.rank,
    displayName: officer.displayName,
    currentUnit: officer.currentUnit,
    currentPosition: officer.currentPosition,
    promotionStatus: officer.promotionIntelligence.promotionStatus,
    displayPromotionStatusTh: officer.promotionIntelligence.displayStatusTh ?? "",
    retirementYearBe: officer.retirementYearBe,
    readinessLevel: officer.documentIntelligence.readinessLevel,
    missingDocumentsCount: officer.documentIntelligence.missingRequiredCount,
    trainingStatusTh: officer.trainingIntelligence.displayStatusTh ?? "",
    priority: priorityByOfficerId.get(officer.officerId) ?? "low",
    nextActionTh: officer.documentIntelligence.primaryActionLabelTh,
    href: buildOfficerProfileUrl(officer.officerId),
  }));
}

// ---------------------------------------------------------------------------
// Executive Summary
// ---------------------------------------------------------------------------

function buildExecutiveSummary(
  officers: readonly CommanderQueryOfficer[],
  dashboard: CommanderDashboard,
  viewModel: CommanderDashboardViewModel
): ExecutiveSummaryViewModel {
  const promotionEligible = viewModel.promotion.eligibleThisYear + viewModel.promotion.alreadyEligible;
  const expiredDocuments = officers.filter((o) => o.documentIntelligence.expiredCount > 0).length;
  const retiringSoon = viewModel.retirement.withinOneYear;
  const missingTraining = viewModel.training.missingRequiredCount;
  const criticalOfficers = dashboard.officers.filter((o) => o.priority === "critical" || o.priority === "high").length;

  const bulletsTh: string[] = [];
  if (promotionEligible > 0) bulletsTh.push(`ครบคุณสมบัติเลื่อนตำแหน่ง ${promotionEligible} นาย`);
  if (expiredDocuments > 0) bulletsTh.push(`เอกสารหมดอายุ ${expiredDocuments} นาย`);
  if (retiringSoon > 0) bulletsTh.push(`ใกล้เกษียณ ${retiringSoon} นาย`);
  if (missingTraining > 0) bulletsTh.push(`ขาดการฝึกอบรม ${missingTraining} นาย`);

  return {
    headlineTh: `วันนี้มีกำลังพลที่ควรดำเนินการเร่งด่วน ${criticalOfficers} นาย`,
    bulletsTh,
    urgentOfficerCount: criticalOfficers,
  };
}

// ---------------------------------------------------------------------------
// Full composition
// ---------------------------------------------------------------------------

export function buildCommanderIntelligenceCenter(
  input: BuildCommanderIntelligenceCenterInput
): CommanderIntelligenceCenterViewModel {
  const { dataset, dashboard, viewModel, asOf } = input;
  const officers = dataset.officers;

  return {
    generatedAtIso: new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate())).toISOString().slice(0, 10),
    kpis: buildKpis(officers, dashboard, viewModel),
    priorityMatrix: buildPriorityMatrix(dashboard),
    actionCenter: buildActionCenter(officers, dashboard, viewModel),
    timeline: buildTimeline(officers, asOf),
    executiveTable: buildExecutiveTable(officers, dashboard),
    executiveSummary: buildExecutiveSummary(officers, dashboard, viewModel),
  };
}
