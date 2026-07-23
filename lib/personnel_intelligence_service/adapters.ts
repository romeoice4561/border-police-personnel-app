/**
 * Thin consumer adapters (Phase 49.5).
 *
 * Prove the facade can reproduce CIC/report surfaces without migrating UI.
 */
import type { PersonnelIntelligenceService } from "@/lib/personnel_intelligence_service/service";
import type { PersonnelIntelligenceQuery } from "@/lib/personnel_intelligence_service/types";

/** Adapter for Commander Dashboard / Intelligence Center style summaries. */
export function commanderDashboardAdapter(service: PersonnelIntelligenceService) {
  return {
    summary: (query?: PersonnelIntelligenceQuery) => service.getCommanderSummary(query),
    brief: (query?: PersonnelIntelligenceQuery) => service.getExecutiveBrief(query),
  };
}

/** Adapter for Executive Reports consumers. */
export function commanderReportsAdapter(service: PersonnelIntelligenceService) {
  return {
    project: (type: string, query?: PersonnelIntelligenceQuery) =>
      service.getReportProjection({
        type,
        scope: query?.scope,
        asOf: query?.asOf,
      }),
    brief: (query?: PersonnelIntelligenceQuery) => service.getExecutiveBrief(query),
  };
}

/**
 * Future AI tool adapter contract — maps tool name → service method.
 * Does not execute AI; callers supply already-validated args.
 */
export function aiToolAdapter(service: PersonnelIntelligenceService) {
  return {
    get_commander_summary: (args: PersonnelIntelligenceQuery = {}) => service.getCommanderSummary(args),
    search_officers: (args: PersonnelIntelligenceQuery = {}) => service.searchOfficers(args),
    get_officer_intelligence: (args: { officerId: string }) => service.getOfficerIntelligence(args.officerId),
    get_promotion_summary: (args: PersonnelIntelligenceQuery = {}) => service.getPromotionSummary(args),
    get_retirement_summary: (args: PersonnelIntelligenceQuery = {}) => service.getRetirementSummary(args),
    get_document_summary: (args: PersonnelIntelligenceQuery = {}) => service.getDocumentSummary(args),
    get_training_summary: (args: PersonnelIntelligenceQuery = {}) => service.getTrainingSummary(args),
    get_executive_brief: (args: PersonnelIntelligenceQuery = {}) => service.getExecutiveBrief(args),
    get_report_projection: (args: { type: string } & PersonnelIntelligenceQuery) =>
      service.getReportProjection({ type: args.type, scope: args.scope, asOf: args.asOf }),
  };
}
