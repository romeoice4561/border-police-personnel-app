/**
 * OfficerDrugArrestPerformanceService (Phase DI-7.7, Section 4).
 *
 * The I/O adapter for composeOfficerDrugArrestPerformance — resolves an
 * officer's DrugCaseOfficer rows into full case facts (batched, no N+1: one
 * forOfficer lookup, one batch findByIds, then per-case-id parallel lookups
 * for defendant count and seized items, mirroring DrugCaseService.getCase()'s
 * established Promise.all-over-distinct-ids convention exactly).
 *
 * Officer-domain and DrugPerson-domain stay fully separate here: this
 * service only ever reads DrugCaseOfficer/DrugCase/DrugCasePerson(count)/
 * DrugSeizedItem — it never creates, reads-as-a-graph-node, or writes a
 * DrugPerson or DrugPersonNetworkRole/DrugRelationship row (Section 3/DI-7.6
 * Section 22/23's domain-separation guarantee extended, never weakened,
 * by this phase).
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugCaseOfficerRepository } from "@/lib/database/repositories/drug_case_officer_repository";
import { DrugCaseRepository } from "@/lib/database/repositories/drug_case_repository";
import { DrugCasePersonRepository } from "@/lib/database/repositories/drug_case_person_repository";
import { composeOfficerDrugArrestPerformance, type OfficerDrugArrestPerformanceSummary } from "@/lib/drug_intelligence/officer_drug_arrest_performance";
import { isValidDrugCategory, isValidDrugMeasurementKind, type DrugCategory, type DrugMeasurementKind } from "@/lib/drug_intelligence/drug_seized_item_options";

export interface OfficerDrugArrestPerformanceServiceDependencies {
  db: DatabaseClient;
}

export class OfficerDrugArrestPerformanceService {
  private readonly db: DatabaseClient;

  constructor(dependencies: OfficerDrugArrestPerformanceServiceDependencies) {
    this.db = dependencies.db;
  }

  /**
   * Returns null when the officer has zero DrugCaseOfficer rows (Section 11:
   * "officer with no DrugCaseOfficer records" — the caller renders an empty
   * state rather than an empty-but-present summary object).
   */
  async getPerformanceSummary(officerId: string): Promise<OfficerDrugArrestPerformanceSummary | null> {
    const caseOfficerRepo = new DrugCaseOfficerRepository(this.db);
    const officerRows = await caseOfficerRepo.forOfficer(officerId);
    if (officerRows.length === 0) return null;

    const caseIds = [...new Set(officerRows.map((r) => r.caseId))];

    const caseRepo = new DrugCaseRepository(this.db);
    const casePersonRepo = new DrugCasePersonRepository(this.db);

    const [cases, defendantCountEntries, seizedItemEntries] = await Promise.all([
      caseRepo.findByIds(caseIds),
      Promise.all(caseIds.map(async (id) => [id, (await casePersonRepo.forCase(id)).length] as const)),
      Promise.all(caseIds.map(async (id) => [id, await caseRepo.seizedItemsForCase(id)] as const)),
    ]);

    const defendantCountByCase = new Map(defendantCountEntries);
    const seizedItemsByCase = new Map(seizedItemEntries);

    const caseFactsById = new Map(
      cases.map((c) => [
        c.id,
        {
          id: c.id,
          caseNumber: c.caseNumber,
          title: c.title,
          status: c.status,
          arrestDate: c.arrestDate,
          province: c.province,
          district: c.district,
          reportingUnitText: c.reportingUnitText,
          leadUnitText: c.leadUnitText,
          defendantCount: defendantCountByCase.get(c.id) ?? 0,
          seizedItems: (seizedItemsByCase.get(c.id) ?? []).flatMap((item) => {
            if (!isValidDrugCategory(item.drugCategory) || !isValidDrugMeasurementKind(item.measurementKind)) return [];
            return [
              {
                drugCategory: item.drugCategory as DrugCategory,
                otherDrugCategoryLabel: item.otherDrugCategoryLabel,
                measurementKind: item.measurementKind as DrugMeasurementKind,
                normalizedCount: item.measurementKind === "COUNT" && item.quantity !== null && item.quantity !== undefined ? Number(item.quantity) : null,
                normalizedWeightGrams: item.measurementKind === "MASS" && item.weightGrams !== null && item.weightGrams !== undefined ? Number(item.weightGrams) : null,
                displayUnit: item.unit ?? null,
              },
            ];
          }),
        },
      ])
    );

    return composeOfficerDrugArrestPerformance(
      officerId,
      officerRows.map((r) => ({ caseId: r.caseId, role: r.role })),
      caseFactsById
    );
  }
}
