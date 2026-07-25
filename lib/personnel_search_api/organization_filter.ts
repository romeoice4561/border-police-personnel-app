/**
 * In-memory organization filter for CommanderQueryDataset (Phase 51.1).
 * Pure — no I/O, no HTTP, no mutation of officer records.
 */
import type { CommanderQueryDataset, CommanderQueryOfficer } from "@/lib/commander_query/types";

/** Returns a shallow-cloned dataset with officers filtered by optional unit ids. */
export function applyOrganizationFilter(
  dataset: CommanderQueryDataset,
  filter: { regionId?: number; divisionId?: number; companyId?: number }
): CommanderQueryDataset {
  const { regionId, divisionId, companyId } = filter;
  if (regionId == null && divisionId == null && companyId == null) {
    return dataset;
  }

  const officers = dataset.officers.filter((o) => matchesOrg(o, filter));
  return { officers, options: dataset.options };
}

function matchesOrg(
  officer: CommanderQueryOfficer,
  filter: { regionId?: number; divisionId?: number; companyId?: number }
): boolean {
  if (filter.companyId != null && officer.companyId !== filter.companyId) return false;
  if (filter.divisionId != null && officer.battalionId !== filter.divisionId) return false;
  if (filter.regionId != null && officer.regionId !== filter.regionId) return false;
  return true;
}
