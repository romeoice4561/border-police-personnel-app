/**
 * Training search — existing TrainingSummary / flags only. No training calculations.
 */
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import { fuzzyContains } from "@/lib/personnel_search/normalizer";
import type { ParsedSearchQuery } from "@/lib/personnel_search/parser";

export function searchTraining(
  officers: CommanderQueryOfficer[],
  parsed: ParsedSearchQuery
): CommanderQueryOfficer[] {
  const q = parsed.raw;

  return officers.filter((o) => {
    const t = o.trainingIntelligence;
    if (/ขาดหลักสูตร|missing\s*required|needs_training/i.test(q)) {
      return (
        o.flagCodes.includes("NEEDS_TRAINING") ||
        o.promotionIntelligence.promotionStatus === "MissingTraining" ||
        t?.trainingStatus === "MissingRequired"
      );
    }
    const requirementNames = [
      ...(t?.requiredRequirements ?? []),
      ...(t?.missingRequirements ?? []),
      ...(t?.completedCourses ?? []).map((c) => ({ displayNameTh: c.courseName })),
    ];
    if (/สืบสวน/.test(q)) {
      return requirementNames.some((r) => fuzzyContains(r.displayNameTh, "สืบสวน"));
    }
    if (/ผู้กำกับ/.test(q)) {
      return requirementNames.some((r) => fuzzyContains(r.displayNameTh, "ผู้กำกับ"));
    }
    if (!t?.available) return o.flagCodes.includes("NEEDS_TRAINING");
    return t.trainingStatus === "MissingRequired" || t.trainingStatus === "Expired" || t.totalRecords > 0;
  });
}

export function trainingSummaryTh(officer: CommanderQueryOfficer): string {
  const t = officer.trainingIntelligence;
  return t?.displayStatusTh ?? (officer.flagCodes.includes("NEEDS_TRAINING") ? "ขาดหลักสูตร" : "—");
}
