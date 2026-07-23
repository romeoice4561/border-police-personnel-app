/**
 * Safe optional resultCount derivation for tool metadata (Phase 49.6).
 * Shallow inspection only — never deep-walks sensitive payloads.
 */
import type { IntelligenceToolName } from "@/lib/personnel_intelligence_service/tools/types";

export function deriveIntelligenceToolResultCount(toolName: IntelligenceToolName, data: unknown): number | undefined {
  if (!data || typeof data !== "object") return undefined;
  const obj = data as Record<string, unknown>;

  switch (toolName) {
    case "search_officers": {
      const pagination = obj.pagination as { total?: unknown } | undefined;
      if (typeof pagination?.total === "number") return pagination.total;
      const aggregate = obj.aggregate as { total?: unknown } | undefined;
      if (typeof aggregate?.total === "number") return aggregate.total;
      return undefined;
    }
    case "get_commander_summary":
      return typeof obj.personnelTotal === "number" ? obj.personnelTotal : undefined;
    case "get_officer_intelligence":
      return 1;
    case "get_report_projection":
      return typeof obj.resultCount === "number" ? obj.resultCount : undefined;
    case "get_executive_brief":
      return typeof obj.totalPersonnel === "number" ? obj.totalPersonnel : undefined;
    case "get_promotion_summary":
      return typeof obj.readyCount === "number" ? obj.readyCount : undefined;
    case "get_retirement_summary":
      return typeof obj.within12Months === "number" ? obj.within12Months : undefined;
    case "get_document_summary":
      return typeof obj.missingRequiredOfficers === "number" ? obj.missingRequiredOfficers : undefined;
    case "get_training_summary":
      return typeof obj.missingRequired === "number" ? obj.missingRequired : undefined;
    default:
      return undefined;
  }
}
