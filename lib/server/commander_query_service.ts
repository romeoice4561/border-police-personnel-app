import "server-only";
import type { OfficerWithRelations } from "@/lib/database/query_types";
import type { Timeline } from "@/lib/database/database_types";
import { calculateAge, calculateGovernmentServiceDuration, calculateRetirement, differenceYMD, type DurationYMD } from "@/lib/personnel_calendar";
import { officerFullName } from "@/lib/ui/officer_summary";
import { toEffectiveDate } from "@/lib/officer_profile/thai_date";
import { buildOfficerProfileIntelligence, loadCommanderOfficerProfiles } from "@/lib/server/commander_intelligence_service";
import { detectPositionLevel, POSITION_LEVELS } from "@/lib/commander_query/position_level";
import type { CommanderQueryDataset, CommanderQueryOfficer } from "@/lib/commander_query/types";
import { loadOrganizationEngine } from "@/lib/organization/organization_engine_server";

function yearsFromDuration(duration: DurationYMD | null): number | null {
  if (!duration) return null;
  return Number((duration.years + duration.months / 12 + duration.days / 365).toFixed(1));
}

function firstServiceLikeDate(officer: OfficerWithRelations): Date | null {
  const dates = officer.timeline
    .map((row) => toEffectiveDate(row))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  return dates[0] ?? null;
}

function startedAtForMatchingTimeline(rows: Timeline[], predicate: (row: Timeline) => boolean): Date | null {
  const matches = rows
    .filter(predicate)
    .map((row) => toEffectiveDate(row))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  return matches[0] ?? null;
}

function yearsSince(date: Date | null, asOf: Date): number | null {
  return yearsFromDuration(date ? differenceYMD(date, asOf) : null);
}

function hasActiveDocument(officer: OfficerWithRelations, typeCode: string): boolean {
  return officer.documents.some((doc) => doc.documentType === typeCode && doc.isActive !== false);
}

function toQueryOfficer(
  officer: OfficerWithRelations,
  asOf: Date,
  orgLabels: { company: string | null }
): CommanderQueryOfficer {
  const intelligence = buildOfficerProfileIntelligence(officer);
  const serviceStart = firstServiceLikeDate(officer);
  const rankStartedAt = startedAtForMatchingTimeline(officer.timeline, (row) => row.rank === officer.rank);
  const positionStartedAt = startedAtForMatchingTimeline(
    officer.timeline,
    (row) => row.position === officer.currentPosition || Boolean(officer.currentPosition && row.position.includes(officer.currentPosition))
  );
  const retirement = calculateRetirement(officer.dateOfBirth ?? null, asOf);
  const displayName = officerFullName(officer);

  return {
    officerId: officer.officerId,
    rank: officer.rank,
    firstName: officer.firstName,
    lastName: officer.lastName,
    displayName,
    currentPosition: officer.currentPosition,
    positionLevel: detectPositionLevel(officer.currentPosition),
    currentUnit: officer.currentUnit,
    regionId: officer.regionId,
    battalionId: officer.battalionId,
    companyId: officer.companyId,
    companyLabel: orgLabels.company || officer.currentUnit || "Unknown Company",
    yearsInRank: yearsSince(rankStartedAt, asOf),
    yearsInPosition: yearsSince(positionStartedAt, asOf),
    governmentServiceYears: yearsFromDuration(calculateGovernmentServiceDuration(serviceStart, asOf)),
    ageYears: yearsFromDuration(calculateAge(officer.dateOfBirth ?? null, asOf)),
    retirementYear: retirement?.retirementDate.getUTCFullYear() ?? null,
    promotionStatus: intelligence.promotionStatus,
    retirementStatus: intelligence.retirementStatus,
    priority: intelligence.priority,
    profileCompletenessPercent: intelligence.profileCompletenessPercent,
    flags: intelligence.flags,
    flagCodes: intelligence.flags.map((flag) => flag.code),
    hasGp7: hasActiveDocument(officer, "GP7"),
    hasOfficialPortrait: Boolean(officer.officialPortraitId || officer.thumbnailUrl || officer.driveFileId),
    hasTraining: officer.training.length > 0,
    hasDocuments: officer.documents.some((doc) => doc.isActive !== false),
    thumbnailUrl: officer.thumbnailUrl,
    driveFileId: officer.driveFileId,
    webViewUrl: officer.webViewUrl,
  };
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))]
    .sort((a, b) => a.localeCompare(b, "th"));
}

export async function getCommanderQueryDataset(): Promise<CommanderQueryDataset> {
  const asOf = new Date();
  const [officers, organizationEngine] = await Promise.all([
    loadCommanderOfficerProfiles(),
    loadOrganizationEngine(),
  ]);
  const rows = officers.map((officer) => {
    const labels = organizationEngine.resolveLabels({
      headquartersId: officer.headquartersId,
      regionId: officer.regionId,
      battalionId: officer.battalionId,
      companyId: officer.companyId,
    });
    return toQueryOfficer(officer, asOf, labels);
  });

  return {
    officers: rows,
    options: {
      ranks: uniqueSorted(rows.map((row) => row.rank)),
      positionLevels: [...POSITION_LEVELS],
      regions: organizationEngine.getRegions().map((region) => ({
        id: region.id,
        label: organizationEngine.resolveLabels({ headquartersId: region.headquartersId, regionId: region.id, battalionId: null, companyId: null }).borderPatrolDivision ?? region.nameTh,
      })),
      battalions: organizationEngine.getBattalions().map((battalion) => ({
        id: battalion.id,
        regionId: battalion.regionId,
        label: battalion.nameTh,
      })),
      companies: organizationEngine.getCompanies().map((company) => ({
        id: company.id,
        battalionId: company.battalionId,
        label: company.nameTh,
      })),
      priorities: ["low", "medium", "high", "critical"],
    },
  };
}
