/**
 * Bounded Cases-list completeness filters (Phase 2E).
 *
 * Matches Commander readiness / missing-arrested semantics so a drill-down
 * count of N opens the same N cases. Applied after the existing list WHERE
 * (dates, org, province) using batched related-row queries — not N+1.
 *
 * Pure I/O helper — no React, no HTTP.
 */

import type { DatabaseClient, DrugCase } from "@/lib/database/database_types";
import type { CommanderUnitGroupBy } from "@/lib/drug_intelligence/drug_commander_filter";

export const CASE_COMPLETENESS_FILTERS = [
  "missingArrested",
  "missingReportingUnit",
  "missingCoordinates",
  "incompleteSeizure",
] as const;
export type CaseCompletenessFilter = (typeof CASE_COMPLETENESS_FILTERS)[number];

export function isCaseCompletenessFilter(value: string | null | undefined): value is CaseCompletenessFilter {
  return value != null && (CASE_COMPLETENESS_FILTERS as readonly string[]).includes(value);
}

export function isCommanderUnitGroupBy(value: string | null | undefined): value is CommanderUnitGroupBy {
  return value === "battalion" || value === "company" || value === "region";
}

const ARRESTED_ROLES = ["ARRESTED_PERSON", "ACCUSED"] as const;

const UNIT_GROUP_FIELD: Record<CommanderUnitGroupBy, "battalionId" | "companyId" | "regionId"> = {
  battalion: "battalionId",
  company: "companyId",
  region: "regionId",
};

export async function filterCasesByCompleteness(
  db: DatabaseClient,
  rows: DrugCase[],
  completeness: CaseCompletenessFilter,
  unitGroup: CommanderUnitGroupBy = "battalion"
): Promise<DrugCase[]> {
  if (rows.length === 0) return rows;
  const caseIds = rows.map((row) => row.id);

  if (completeness === "missingCoordinates") {
    return rows.filter((row) => row.latitude == null || row.longitude == null);
  }

  if (completeness === "missingReportingUnit") {
    const field = UNIT_GROUP_FIELD[unitGroup];
    return rows.filter((row) => row[field] == null);
  }

  if (completeness === "missingArrested") {
    const personRows = await db.drugCasePerson.findMany({
      where: {
        caseId: { in: caseIds },
        role: { in: ARRESTED_ROLES as unknown as string[] },
      },
      select: { caseId: true },
    });
    const linked = new Set((personRows as Array<{ caseId: string }>).map((row) => row.caseId));
    return rows.filter((row) => !linked.has(row.id));
  }

  const seizedRows = await db.drugSeizedItem.findMany({
    where: { caseId: { in: caseIds } },
    select: { caseId: true, drugCategory: true },
  });
  const incomplete = new Set<string>();
  for (const row of seizedRows as Array<{ caseId: string; drugCategory: string }>) {
    if (!row.drugCategory || row.drugCategory === "OTHER") incomplete.add(row.caseId);
  }
  return rows.filter((row) => incomplete.has(row.id));
}
