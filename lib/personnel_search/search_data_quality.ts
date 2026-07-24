/**
 * Data quality search — reuses PromotionSummary confidence / flags / missing evidence.
 */
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { ParsedSearchQuery } from "@/lib/personnel_search/parser";

export function searchDataQuality(
  officers: CommanderQueryOfficer[],
  parsed: ParsedSearchQuery
): CommanderQueryOfficer[] {
  const { flags } = parsed;

  return officers.filter((o) => {
    const p = o.promotionIntelligence;

    if (flags.missingLevelStart) {
      return (
        p.missingEvidence.includes("current_position_level_start_date") ||
        p.missingEvidence.includes("current_rank_start_date") ||
        p.confidence === "incomplete"
      );
    }
    if (flags.missingTarget) {
      return !p.targetLevel || p.targetLevel === "";
    }
    if (flags.incompleteData) {
      return (
        p.confidence === "incomplete" ||
        p.confidence === "unknown" ||
        o.flagCodes.includes("PROFILE_INCOMPLETE") ||
        p.promotionStatus === "Unknown"
      );
    }
    if (/unknown\s*promotion|สถานะ.*ไม่ทราบ|ประเมินไม่ได้/i.test(parsed.raw)) {
      return p.promotionStatus === "Unknown" || p.confidence === "unknown";
    }
    return (
      p.confidence === "incomplete" ||
      p.confidence === "unknown" ||
      o.flagCodes.includes("PROFILE_INCOMPLETE") ||
      p.missingEvidence.length > 0
    );
  });
}

export function dataQualitySummaryTh(officer: CommanderQueryOfficer): string {
  const p = officer.promotionIntelligence;
  if (p.confidenceReasonTh) return p.confidenceReasonTh;
  if (
    p.missingEvidence.includes("current_position_level_start_date") ||
    p.missingEvidence.includes("current_rank_start_date")
  ) {
    return "ไม่มีปีเริ่มดำรงระดับ";
  }
  if (!p.targetLevel) return "ไม่มีระดับเป้าหมาย";
  if (p.promotionStatus === "Unknown") return "สถานะเลื่อนระดับไม่ทราบ";
  return "ข้อมูลไม่สมบูรณ์";
}
