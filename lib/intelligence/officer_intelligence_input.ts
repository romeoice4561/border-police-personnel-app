/**
 * Pure Officer -> OfficerIntelligenceCard composition (extracted from
 * lib/server/commander_intelligence_service.ts, Phase 44).
 *
 * No `server-only`, no Prisma, no I/O — genuinely pure over an
 * already-loaded OfficerWithRelations, so it can be unit-tested directly
 * and reused by lib/commander_query/query_officer.ts (which itself must be
 * testable — see lib/officer_intelligence/__tests__/view_model.test.ts).
 * lib/server/commander_intelligence_service.ts re-exports
 * `buildOfficerProfileIntelligence` for existing call sites — no behavior
 * change, just relocated so the pure part isn't trapped behind a
 * server-only barrier.
 */
import type { OfficerWithRelations } from "@/lib/database/query_types";
import { computeProfileCompleteness } from "@/lib/ui/profile_completeness";
import { officerFullName } from "@/lib/ui/officer_summary";
import { firstServiceLikeDate } from "@/lib/intelligence/shared/timeline_dates";
import { buildOfficerIntelligenceCard, type OfficerIntelligenceCard, type OfficerIntelligenceInput } from "@/lib/intelligence";
import { buildPromotionContext, createRequiredDocumentsRule, createRequiredTrainingRule } from "@/lib/promotion";
import { calculateRetirement } from "@/lib/personnel_calendar";

export function toIntelligenceInput(officer: OfficerWithRelations, asOf: Date = new Date()): OfficerIntelligenceInput {
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

export function buildOfficerProfileIntelligence(officer: OfficerWithRelations, asOf: Date = new Date()): OfficerIntelligenceCard {
  return buildOfficerIntelligenceCard(toIntelligenceInput(officer, asOf));
}
