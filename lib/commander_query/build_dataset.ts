/**
 * Pure CommanderQueryDataset composition (Phase 49A.1).
 *
 * Builds the canonical CommanderQueryOfficer[] read model from already-loaded
 * officer profiles + organization/skill/portrait inputs. No I/O — callers own
 * loading. Shared by getCommanderQueryDataset() (Commander Search) and the
 * Dashboard page orchestrator so both paths produce the SAME shape without a
 * second parallel representation.
 */
import { POSITION_LEVELS } from "@/lib/commander_query/position_level";
import { toQueryOfficer } from "@/lib/commander_query/query_officer";
import type { CommanderQueryDataset } from "@/lib/commander_query/types";
import type { OfficerWithRelations } from "@/lib/database/query_types";
import type { OrganizationEngine } from "@/lib/organization/organization_engine";
import type { SkillCatalog } from "@/lib/capability/capability_types";

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))].sort((a, b) =>
    a.localeCompare(b, "th")
  );
}

export interface BuildCommanderQueryDatasetInput {
  officers: readonly OfficerWithRelations[];
  organizationEngine: OrganizationEngine;
  skillCatalog: SkillCatalog;
  /** officerId → resolved Official Portrait URL (null when unresolved). */
  officialPortraitByOfficerId: ReadonlyMap<string, string | null>;
  asOf: Date;
}

/**
 * Composes CommanderQueryDataset from preloaded inputs. Side-effect free.
 * Document intelligence is computed once per officer inside toQueryOfficer.
 */
export function buildCommanderQueryDataset(input: BuildCommanderQueryDatasetInput): CommanderQueryDataset {
  const { officers, organizationEngine, skillCatalog, officialPortraitByOfficerId, asOf } = input;

  const rows = officers.map((officer) => {
    const labels = organizationEngine.resolveLabels({
      headquartersId: officer.headquartersId,
      regionId: officer.regionId,
      battalionId: officer.battalionId,
      companyId: officer.companyId,
    });
    const officialPortraitUrl = officialPortraitByOfficerId.get(officer.officerId) ?? null;
    return toQueryOfficer(officer, asOf, labels, officialPortraitUrl);
  });

  return {
    officers: rows,
    options: {
      ranks: uniqueSorted(rows.map((row) => row.rank)),
      positionLevels: [...POSITION_LEVELS],
      regions: organizationEngine.getRegions().map((region) => ({
        id: region.id,
        label:
          organizationEngine.resolveLabels({
            headquartersId: region.headquartersId,
            regionId: region.id,
            battalionId: null,
            companyId: null,
          }).borderPatrolDivision ?? region.nameTh,
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
      skillCatalog,
    },
  };
}
