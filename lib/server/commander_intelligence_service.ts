/**
 * Server-side adapter for Commander Intelligence UI.
 *
 * Maps persisted officer data into the pure Phase 36 intelligence engine.
 * No React and no business logic in UI components.
 */

import "server-only";
import { createDatabaseClient } from "@/lib/database/database";
import type { OfficerWithRelations, ReadDatabaseClient } from "@/lib/database/query_types";
import { OfficerQueryRepository } from "@/lib/database/repositories/officer_query_repository";
import { computeProfileCompleteness } from "@/lib/ui/profile_completeness";
import { toEffectiveDate } from "@/lib/officer_profile/thai_date";
import { officerFullName } from "@/lib/ui/officer_summary";
import { buildCommanderDashboard, buildOfficerIntelligenceCard, type CommanderDashboard, type OfficerIntelligenceCard, type OfficerIntelligenceInput } from "@/lib/intelligence";
import { buildPromotionContext, createRequiredDocumentsRule, createRequiredTrainingRule } from "@/lib/promotion";
import { calculateRetirement } from "@/lib/personnel_calendar";

let cachedRepository: OfficerQueryRepository | undefined;

function officerRepository(): OfficerQueryRepository {
  if (!cachedRepository) {
    const client = createDatabaseClient() as unknown as ReadDatabaseClient;
    cachedRepository = new OfficerQueryRepository(client);
  }
  return cachedRepository;
}

export async function loadCommanderOfficerProfiles(): Promise<OfficerWithRelations[]> {
  const client = createDatabaseClient() as unknown as {
    officer: {
      findMany(args: Record<string, unknown>): Promise<OfficerWithRelations[]>;
    };
  };
  return client.officer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      timeline: { orderBy: { sequence: "asc" } },
      phones: true,
      education: { orderBy: { id: "asc" } },
      training: { orderBy: { id: "asc" } },
      salaryHistory: { orderBy: { yearBE: "desc" } },
      documents: { orderBy: { createdAt: "desc" } },
      // Phase 44: skills with skill (+ category) and level resolved, so the
      // commander read model and dashboard can derive skill signals. Additive
      // include only — the intelligence computation itself is unchanged.
      skills: { include: { skill: { include: { category: true } }, level: true }, orderBy: { id: "asc" } },
    },
  });
}

function firstServiceLikeDate(officer: OfficerWithRelations): Date | null {
  const dates = officer.timeline
    .map((row) => toEffectiveDate(row))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  return dates[0] ?? null;
}

function toIntelligenceInput(officer: OfficerWithRelations): OfficerIntelligenceInput {
  const asOf = new Date();
  const trainingRecords = officer.training.map((row) => ({ code: row.course || `TRAINING_${row.id}` }));
  const documents = officer.documents.map((doc) => ({
    typeCode: doc.documentType,
    isActive: doc.isActive,
    verifiedAt: doc.verifiedAt,
  }));
  const intelligenceTrainingRecords = trainingRecords.length > 0 ? [{ code: "ANY_TRAINING" }, ...trainingRecords] : [];
  const promotionContext = buildPromotionContext({
    asOf,
    currentRank: officer.rank,
    currentPosition: officer.currentPosition,
    // Schema has no confirmed official service-start field yet. Earliest
    // timeline date is passed only as an available context signal, not treated
    // as official policy by the intelligence engine.
    governmentServiceStartDate: firstServiceLikeDate(officer),
    dateOfBirth: officer.dateOfBirth ?? null,
    trainingRecords: intelligenceTrainingRecords,
    documents,
  });

  return {
    officerId: officer.officerId,
    displayName: officerFullName(officer),
    promotionContext,
    promotionRules: [
      createRequiredDocumentsRule({ requiredDocumentTypes: ["GP7"], score: 20 }),
      createRequiredTrainingRule({ requiredTrainingCodes: ["ANY_TRAINING"], score: 20 }),
    ],
    profileCompletenessPercent: computeProfileCompleteness(officer).percent,
    hasOfficialPortrait: Boolean(officer.officialPortraitId || officer.thumbnailUrl || officer.driveFileId),
    documents,
    trainingRecords: intelligenceTrainingRecords,
    remainingUntilRetirement: calculateRetirement(officer.dateOfBirth ?? null, asOf)?.remaining ?? null,
  };
}

export async function getCommanderDashboardIntelligence(): Promise<CommanderDashboard> {
  const officers = await loadCommanderOfficerProfiles();
  return buildCommanderDashboard(officers.map(toIntelligenceInput));
}

export function buildOfficerProfileIntelligence(officer: OfficerWithRelations): OfficerIntelligenceCard {
  return buildOfficerIntelligenceCard(toIntelligenceInput(officer));
}

export async function getOfficerIntelligence(officerId: string): Promise<OfficerIntelligenceCard | null> {
  const officer = await officerRepository().findByOfficerId(officerId);
  return officer ? buildOfficerProfileIntelligence(officer) : null;
}
