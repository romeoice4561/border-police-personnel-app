/**
 * Shared fixtures for Phase 49.6 tool-layer tests.
 */
import { defaultPermissionsForRole } from "@/lib/auth/roles";
import type { AuthUser } from "@/lib/auth/types";
import type { CommanderQueryDataset, CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { CommanderDashboard } from "@/lib/intelligence";
import type { CommanderDashboardViewModel } from "@/lib/commander_dashboard/types";
import { buildCommanderIntelligenceCenter } from "@/lib/commander_intelligence_center/build_view_model";
import { composeOfficerDocumentIntelligence } from "@/lib/integration/documents/document_intelligence_contract";
import type { PromotionSummary } from "@/lib/intelligence/shared/types";
import type { TrainingSummary } from "@/lib/intelligence/training/types";
import { createPersonnelIntelligenceContext } from "@/lib/personnel_intelligence_service/context";
import { actorFromAuthUser } from "@/lib/personnel_intelligence_service/permissions";
import { createPersonnelIntelligenceService } from "@/lib/personnel_intelligence_service/service";

export const ASOF = new Date("2026-07-23T00:00:00.000Z");

export function user(role: AuthUser["role"], officerId: string | null = null): AuthUser {
  return {
    id: `mock:${role}`,
    username: role,
    displayName: role,
    role,
    permissions: defaultPermissionsForRole(role),
    officerId,
    mustChangePassword: false,
    isActive: true,
  };
}

function fakePromotion(): PromotionSummary {
  return {
    available: true,
    status: "not_eligible",
    eligibleNow: false,
    monthsUntilEligible: null,
    overdueYears: null,
    eligibleYearOrdinal: null,
    targetLevel: null,
    currentRank: null,
    currentPosition: null,
    targetRank: null,
    targetPosition: null,
    promotionStatus: "NotEligible",
    eligibleDate: null,
    eligibleFiscalYearBe: null,
    firstEligibleDate: null,
    firstEligibleYearBe: null,
    firstEligibleFiscalYearBe: null,
    displayReasonTh: null,
    remainingTenureYears: null,
    displayRemainingTenureTh: null,
    yearsEligible: null,
    monthsEligible: null,
    daysEligible: null,
    promotionCyclesPassed: null,
    displayEligibleSinceTh: null,
    displayStatusTh: "ยังไม่ครบคุณสมบัติ",
    requiredTenureYears: null,
    waitingReasonTh: null,
    confidence: "confirmed",
    confidenceReasonTh: null,
    missingEvidence: [],
    priority: null,
    priorityReason: null,
  };
}

function fakeTraining(): TrainingSummary {
  return {
    available: false,
    asOfDate: "2026-07-23",
    totalRecords: 0,
    verifiedRecords: 0,
    unverifiedRecords: 0,
    completedCourseCount: 0,
    missingRequiredCourseCount: 0,
    expiringSoonCount: 0,
    expiredCount: 0,
    requiredRequirements: [],
    completedCourses: [],
    missingRequirements: [],
    expiringSoon: [],
    expired: [],
    trainingStatus: "NoData",
    displayStatusTh: "ไม่มีข้อมูลหลักสูตร",
    recommendationsTh: [],
    dataQualityFlags: [],
  };
}

export function officer(id: string, overrides: Partial<CommanderQueryOfficer> = {}): CommanderQueryOfficer {
  const documentIntelligence =
    overrides.documentIntelligence ??
    composeOfficerDocumentIntelligence({ officerId: id, officerPk: 1, documents: [], asOf: ASOF });
  return {
    officerId: id,
    rank: "ร.ต.อ.",
    firstName: "ทดสอบ",
    lastName: id,
    displayName: `Officer ${id}`,
    currentPosition: "รอง สว.",
    positionLevel: "สว.",
    currentUnit: "กก.1",
    regionId: 1,
    battalionId: 10,
    companyId: 100,
    companyLabel: "ร้อย.1",
    yearsInRank: null,
    yearsInPosition: null,
    yearsInPositionLevel: null,
    positionLevelYearCount: null,
    rankStartedAtYearBe: null,
    yearsInRankCount: null,
    completedPromotionCycles: null,
    governmentServiceYears: null,
    ageYears: 40,
    retirementYear: 2030,
    retirementYearBe: 2573,
    promotionStatus: "not_eligible",
    retirementStatus: "normal",
    priority: "low",
    profileCompletenessPercent: 100,
    flags: [],
    flagCodes: [],
    hasGp7: false,
    hasOfficialPortrait: false,
    hasTraining: false,
    hasDocuments: false,
    academyClass: null,
    isGpfMember: null,
    isCooperativeMember: null,
    cooperativeName: null,
    eligibleTwoStep: false,
    mustSkipStep: false,
    skillSignals: [],
    nextLevelEligibility: null,
    promotionIntelligence: fakePromotion(),
    trainingIntelligence: fakeTraining(),
    dateOfBirth: new Date("1986-08-01T00:00:00.000Z"),
    displayServiceDurationTh: "16 ปี",
    positionLevelStartYearBe: null,
    displayAgeYearsMonthsTh: "40 ปี, 0 เดือน",
    appointmentCycle: null,
    eligibleCycle: null,
    overdueCycles: 0,
    promotionCycleBucket: "not_eligible",
    thumbnailUrl: null,
    driveFileId: null,
    webViewUrl: null,
    officialPortraitUrl: null,
    documentIntelligence,
    documentExpiryInfo: [],
    ...overrides,
  };
}

function emptyViewModel(): CommanderDashboardViewModel {
  return {
    generatedAt: ASOF.toISOString(),
    fiscalYearBe: 2569,
    displayFiscalYearTh: "ปีงบประมาณ 2569",
    personnelOverview: { totalPersonnel: 0, activePersonnel: 0, dataUnavailableCount: 0 },
    promotion: {
      eligibleThisYear: 0,
      alreadyEligible: 0,
      waiting: 0,
      missingTraining: 0,
      missingDocuments: 0,
      retirementRestricted: 0,
      unknown: 0,
      priorityCandidates: [],
    },
    birthdays: {
      todayCount: 0,
      nextSevenDaysCount: 0,
      thisMonthCount: 0,
      today: [],
      nextSevenDays: [],
      thisMonth: [],
    },
    retirement: { withinOneYear: 0, withinThreeYears: 0, withinFiveYears: 0, candidates: [] },
    training: {
      policyConfigured: false,
      missingRequiredCount: 0,
      expiredCount: 0,
      expiringSoonCount: 0,
    },
  } as unknown as CommanderDashboardViewModel;
}

function dashboardFrom(officers: CommanderQueryOfficer[]): CommanderDashboard {
  return {
    summary: {
      totalOfficers: officers.length,
      promotionReady: 0,
      nearPromotion: 0,
      retiringSoon: 0,
      incompleteProfiles: 0,
      missingDocuments: 0,
      missingGp7: 0,
      missingPortrait: 0,
      missingTraining: 0,
    },
    officers: officers.map((o) => ({
      officerId: o.officerId,
      displayName: o.displayName,
      promotionStatus: "not_eligible",
      retirementStatus: "normal",
      profileCompleteness: "high",
      profileCompletenessPercent: o.profileCompletenessPercent,
      priority: o.priority,
      priorityScore: 0,
      flags: [],
      recommendations: [],
    })),
  } as unknown as CommanderDashboard;
}

export function makeBundle(role: AuthUser["role"], officers: CommanderQueryOfficer[], officerId: string | null = null) {
  const dataset: CommanderQueryDataset = {
    officers,
    options: {
      ranks: ["ร.ต.อ."],
      positionLevels: ["สว."],
      regions: [{ id: 1, label: "ภาค 4" }],
      battalions: [{ id: 10, regionId: 1, label: "กก.1" }],
      companies: [{ id: 100, battalionId: 10, label: "ร้อย.1" }],
      priorities: ["low", "medium", "high", "critical"],
      skillCatalog: { categories: [], levels: [] },
    },
  };
  const dashboard = dashboardFrom(officers);
  const viewModel = emptyViewModel();
  const center = buildCommanderIntelligenceCenter({ dataset, dashboard, viewModel, asOf: ASOF });
  const actor = actorFromAuthUser(user(role, officerId));
  const context = createPersonnelIntelligenceContext({
    actor,
    asOf: ASOF,
    dataset,
    dashboard,
    viewModel,
    center,
  });
  const service = createPersonnelIntelligenceService(context);
  return { actor, context, service, dataset };
}
