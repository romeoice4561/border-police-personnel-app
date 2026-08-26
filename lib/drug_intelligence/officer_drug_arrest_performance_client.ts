/**
 * Officer Drug-Arrest Performance — client-facing (serialized) shape (Phase
 * DI-7.7). Mirrors DrugCaseListRow/DrugTimelineEvent's own established
 * convention exactly: every Date becomes an ISO string before crossing the
 * Server -> Client Component boundary — never a raw Date prop.
 *
 * Pure — no I/O, no React.
 */

import type {
  OfficerDrugArrestPerformanceSummary,
  OfficerDrugArrestCaseSummary,
  OfficerDrugArrestSeizureGroup,
} from "@/lib/drug_intelligence/officer_drug_arrest_performance";

export interface OfficerDrugArrestCaseSummaryView extends Omit<OfficerDrugArrestCaseSummary, "arrestDate"> {
  arrestDate: string | null;
}

export interface OfficerDrugArrestPerformanceView extends Omit<OfficerDrugArrestPerformanceSummary, "cases" | "latestArrestDate"> {
  latestArrestDate: string | null;
  cases: OfficerDrugArrestCaseSummaryView[];
}

export function serializeOfficerDrugArrestPerformance(summary: OfficerDrugArrestPerformanceSummary): OfficerDrugArrestPerformanceView {
  return {
    ...summary,
    latestArrestDate: summary.latestArrestDate ? summary.latestArrestDate.toISOString() : null,
    cases: summary.cases.map((c) => ({ ...c, arrestDate: c.arrestDate ? c.arrestDate.toISOString() : null })),
  };
}

export type { OfficerDrugArrestSeizureGroup };
