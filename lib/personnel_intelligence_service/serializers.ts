/**
 * Allowlist serializers for Personnel Intelligence DTOs (Phase 49.5).
 *
 * Explicit field copies — never spread CommanderQueryOfficer / Prisma rows.
 * Sensitive keys are excluded by construction; tests assert absence.
 */
import type { CommanderQueryOfficer, CommanderQueryOptions } from "@/lib/commander_query/types";
import { buildOfficerProfileUrl } from "@/lib/integration/navigation/drilldown_contract";
import type {
  FilterOptionsDto,
  OfficerIntelligenceDetailDto,
  OfficerIntelligenceSummaryDto,
} from "@/lib/personnel_intelligence_service/types";

/** Keys that must never appear in serialized intelligence payloads. */
export const FORBIDDEN_INTELLIGENCE_KEYS = [
  "nationalId",
  "passport",
  "passportNumber",
  "ocrRawText",
  "ocrText",
  "ocrConfidence",
  "fingerprint",
  "storagePath",
  "bucket",
  "signedUrl",
  "downloadUrl",
  "accessToken",
  "refreshToken",
  "password",
  "bankAccount",
  "bankAccountNumber",
  "salaryHistory",
  "privateNotes",
  "adminNotes",
  "driveFileId",
  "webViewUrl",
  "thumbnailUrl",
] as const;

export function serializeFilterOptions(options: CommanderQueryOptions): FilterOptionsDto {
  return {
    ranks: [...options.ranks],
    positionLevels: [...options.positionLevels],
    regions: options.regions.map((r) => ({ id: r.id, label: r.label })),
    battalions: options.battalions.map((b) => ({
      id: b.id,
      regionId: b.regionId,
      label: b.label,
    })),
    companies: options.companies.map((c) => ({
      id: c.id,
      battalionId: c.battalionId,
      label: c.label,
    })),
    priorities: [...options.priorities],
  };
}

export function serializeOfficerSummary(officer: CommanderQueryOfficer): OfficerIntelligenceSummaryDto {
  return {
    officerId: officer.officerId,
    rank: officer.rank,
    displayName: officer.displayName,
    currentPosition: officer.currentPosition,
    currentUnit: officer.currentUnit,
    regionId: officer.regionId,
    battalionId: officer.battalionId,
    companyId: officer.companyId,
    companyLabel: officer.companyLabel,
    priority: officer.priority,
    readinessLevel: officer.documentIntelligence.readinessLevel,
    promotionStatus: officer.promotionIntelligence.promotionStatus,
    displayPromotionStatusTh: officer.promotionIntelligence.displayStatusTh,
    retirementYearBe: officer.retirementYearBe,
    trainingStatus: officer.trainingIntelligence.trainingStatus,
    displayTrainingStatusTh: officer.trainingIntelligence.displayStatusTh,
    missingDocumentsCount: officer.documentIntelligence.missingRequiredCount,
    expiredDocumentsCount: officer.documentIntelligence.expiredCount,
    hasOfficialPortrait: Boolean(officer.officialPortraitUrl),
    officialPortraitUrl: officer.officialPortraitUrl,
    nextActionTh: officer.documentIntelligence.primaryActionLabelTh || "",
    profileHref: buildOfficerProfileUrl(officer.officerId),
  };
}

export function serializeOfficerDetail(officer: CommanderQueryOfficer): OfficerIntelligenceDetailDto {
  const summary = serializeOfficerSummary(officer);
  const recommendedActionsTh: string[] = [];
  if (officer.documentIntelligence.primaryActionLabelTh) {
    recommendedActionsTh.push(officer.documentIntelligence.primaryActionLabelTh);
  }
  for (const flag of officer.flagCodes) {
    recommendedActionsTh.push(flag);
  }
  return {
    ...summary,
    ageDisplayTh: officer.displayAgeYearsMonthsTh,
    serviceDisplayTh: officer.displayServiceDurationTh,
    displayAgeYearsMonthsTh: officer.displayAgeYearsMonthsTh,
    flagCodes: [...officer.flagCodes],
    recommendedActionsTh,
    birthdayIso: officer.dateOfBirth ? officer.dateOfBirth.toISOString().slice(0, 10) : null,
    // Phase 49.7: canonical promotion ground-truth — explicit field copies
    // from PromotionSummary, same as every other field on this DTO.
    targetPositionLevel: officer.promotionIntelligence.targetPosition,
    currentPositionLevelStartYearBe: officer.positionLevelStartYearBe,
    requiredTenureYears: officer.promotionIntelligence.requiredTenureYears,
    firstEligibleYearBe: officer.promotionIntelligence.firstEligibleFiscalYearBe,
    firstEligibleDate: officer.promotionIntelligence.firstEligibleDate,
    waitingReasonTh: officer.promotionIntelligence.waitingReasonTh,
    // Phase 49.8: canonical rank-tenure + data-confidence fields.
    currentRankStartedAtYearBe: officer.rankStartedAtYearBe,
    yearsInRank: officer.yearsInRankCount,
    promotionConfidence: officer.promotionIntelligence.confidence,
    promotionConfidenceReasonTh: officer.promotionIntelligence.confidenceReasonTh,
    promotionMissingEvidence: [...officer.promotionIntelligence.missingEvidence],
  };
}

/** Deep JSON scan for forbidden sensitive keys (test + runtime guard). */
export function assertNoSensitiveKeys(payload: unknown, path = "root"): void {
  if (payload == null) return;
  if (Array.isArray(payload)) {
    payload.forEach((item, index) => assertNoSensitiveKeys(item, `${path}[${index}]`));
    return;
  }
  if (typeof payload !== "object") return;
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    for (const forbidden of FORBIDDEN_INTELLIGENCE_KEYS) {
      if (lower === forbidden.toLowerCase() || lower.includes(forbidden.toLowerCase())) {
        throw new Error(`Sensitive key leaked at ${path}.${key}`);
      }
    }
    assertNoSensitiveKeys(value, `${path}.${key}`);
  }
}
