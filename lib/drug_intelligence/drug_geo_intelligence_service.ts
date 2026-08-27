/**
 * DrugGeoIntelligenceService (Phase DI-8, Section 6/30/32).
 *
 * The I/O adapter for composeDrugGeoResult — resolves a filtered set of
 * cases into full geo facts, batched (Section 30: "avoid one complete
 * getCase() call per marker"). Reuses DrugCaseRepository.list()'s existing
 * filter surface (Section 1: "do not create duplicate geo services if DI-7
 * already provides useful foundations") for date/province/district/org
 * filtering, then batch-resolves persons/seizures/participating-units/
 * officers/alerts per case with Promise.all over the filtered case id set —
 * same convention as DrugCaseService.getCase() and
 * OfficerDrugArrestPerformanceService.
 *
 * Person/case/officer/network domains are read here exactly as they exist
 * elsewhere — this service creates nothing, merges nothing, and infers no
 * new relationships (Section 0/23: no travel inference, no criminal
 * concentration claims — those judgments belong to the UI layer's wording,
 * this layer only returns facts).
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugCaseRepository, type DrugCaseListParams } from "@/lib/database/repositories/drug_case_repository";
import { DrugCasePersonRepository } from "@/lib/database/repositories/drug_case_person_repository";
import { DrugPersonRepository } from "@/lib/database/repositories/drug_person_repository";
import { DrugCaseParticipatingUnitRepository } from "@/lib/database/repositories/drug_case_participating_unit_repository";
import { DrugCaseOfficerRepository } from "@/lib/database/repositories/drug_case_officer_repository";
import { DrugEntityRepository } from "@/lib/database/repositories/drug_entity_repository";
import { DrugIntelligenceAlertRepository } from "@/lib/database/repositories/drug_intelligence_alert_repository";
import { composeDrugGeoResult, type DrugGeoResult, type DrugGeoCaseFacts } from "@/lib/drug_intelligence/drug_geo_marker";
import { isValidDrugCategory, isValidDrugMeasurementKind, type DrugCategory, type DrugMeasurementKind } from "@/lib/drug_intelligence/drug_seized_item_options";

export interface DrugGeoQuery extends DrugCaseListParams {
  /** Section 14: case appears if AT LEAST ONE seized item matches this category — never restricts to cases where it's the only category. */
  drugCategory?: string;
  /** Section 21: person deep-link — restricts to cases this person is linked to (as a case subject). */
  personId?: string;
}

export interface DrugGeoIntelligenceServiceDependencies {
  db: DatabaseClient;
}

const ARREST_LOCATION_ROLE = "ARREST_LOCATION";

export class DrugGeoIntelligenceService {
  private readonly db: DatabaseClient;

  constructor(dependencies: DrugGeoIntelligenceServiceDependencies) {
    this.db = dependencies.db;
  }

  async getGeoResult(query: DrugGeoQuery): Promise<DrugGeoResult> {
    const caseRepo = new DrugCaseRepository(this.db);
    const casePersonRepo = new DrugCasePersonRepository(this.db);
    const personRepo = new DrugPersonRepository(this.db);
    const participatingUnitRepo = new DrugCaseParticipatingUnitRepository(this.db);
    const caseOfficerRepo = new DrugCaseOfficerRepository(this.db);
    const entityRepo = new DrugEntityRepository(this.db);
    const alertRepo = new DrugIntelligenceAlertRepository(this.db);

    const { drugCategory, personId, ...listParams } = query;

    // Unbounded page size — the geo workspace needs every matching case for
    // the map/list/province-breakdown to agree with each other, not one
    // page of results (this mirrors listCases()'s own
    // page:1/pageSize:MAX_SAFE_INTEGER pattern for the same reason when it
    // needs the FULL filtered set before applying a cross-table filter).
    const { rows: allMatchingCases } = await caseRepo.list({ ...listParams, page: 1, pageSize: Number.MAX_SAFE_INTEGER });

    // Person deep-link filter (Section 21): resolved as a caseId allow-list
    // BEFORE the per-case batch loads below, same "resolve ids first" shape
    // DrugCaseRepository.findCaseIdsMatchingQuery and
    // DrugCaseService.listCases's participatingUnitCompanyId/officerId
    // filters already use.
    let candidateCases = allMatchingCases;
    if (personId) {
      const personCaseLinks = await casePersonRepo.forPerson(personId);
      const allowedCaseIds = new Set(personCaseLinks.map((l) => l.caseId));
      candidateCases = candidateCases.filter((c) => allowedCaseIds.has(c.id));
    }

    // Batch-load every per-case dataset in parallel across the candidate set
    // (Section 30: no N+1 — one Promise.all per data kind, not one getCase()
    // per case).
    const [personLinksByCase, seizedItemsByCase, participatingUnitsByCase, officersByCase, locationsByCase, alertsByCase] = await Promise.all([
      Promise.all(candidateCases.map(async (c) => [c.id, await casePersonRepo.forCase(c.id)] as const)),
      Promise.all(candidateCases.map(async (c) => [c.id, await caseRepo.seizedItemsForCase(c.id)] as const)),
      Promise.all(candidateCases.map(async (c) => [c.id, await participatingUnitRepo.forCase(c.id)] as const)),
      Promise.all(candidateCases.map(async (c) => [c.id, await caseOfficerRepo.forCase(c.id)] as const)),
      Promise.all(candidateCases.map(async (c) => [c.id, await caseRepo.caseLocationsForCase(c.id)] as const)),
      Promise.all(candidateCases.map(async (c) => [c.id, await alertRepo.findForCase(c.id)] as const)),
    ]);

    const personLinksMap = new Map(personLinksByCase);
    const seizedItemsMap = new Map(seizedItemsByCase);
    const participatingUnitsMap = new Map(participatingUnitsByCase);
    const officersMap = new Map(officersByCase);
    const locationsMap = new Map(locationsByCase);
    const alertsMap = new Map(alertsByCase);

    // Batch-resolve distinct DrugPerson names referenced across every
    // candidate case's persons (one lookup per distinct person, not per
    // case-person link) — same distinct-id-then-map pattern
    // DrugCaseService.getCase() already uses.
    const distinctPersonIds = new Set<string>();
    for (const links of personLinksMap.values()) {
      for (const link of links) distinctPersonIds.add(link.personId);
    }
    const personEntries = await Promise.all([...distinctPersonIds].map((id) => personRepo.findById(id)));
    const personById = new Map(personEntries.filter((p): p is NonNullable<typeof p> => p !== null).map((p) => [p.id, p]));

    // Batch-resolve the ARREST_LOCATION DrugLocation coordinates for every
    // candidate case (Section 7's precedence rule, step 2) — one distinct
    // DrugLocation lookup per case that has an arrest-location link, never
    // more than one per case (a case with multiple ARREST_LOCATION rows
    // uses the first — an edge case this codebase's Create Case UI doesn't
    // currently produce, since Section 4's location role is single-select
    // per row, not documented further here since it's outside this phase's
    // required behavior).
    const arrestLocationEntries = await Promise.all(
      candidateCases.map(async (c) => {
        const links = locationsMap.get(c.id) ?? [];
        const arrestLink = links.find((l) => l.role === ARREST_LOCATION_ROLE);
        if (!arrestLink) return [c.id, null] as const;
        const location = await entityRepo.findLocationById(arrestLink.locationId);
        return [c.id, location] as const;
      })
    );
    const arrestLocationMap = new Map(arrestLocationEntries);

    const caseFacts: DrugGeoCaseFacts[] = candidateCases.map((c) => {
      const personLinks = personLinksMap.get(c.id) ?? [];
      const persons = personLinks
        .map((link) => personById.get(link.personId))
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .map((p) => ({ personId: p.id, primaryFullName: p.primaryFullName }));

      const rawSeizedItems = seizedItemsMap.get(c.id) ?? [];
      const seizedItems = rawSeizedItems.flatMap((item) => {
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
      });

      const arrestLocation = arrestLocationMap.get(c.id) ?? null;
      const alerts = alertsMap.get(c.id) ?? [];

      return {
        caseId: c.id,
        caseNumber: c.caseNumber,
        title: c.title,
        status: c.status,
        arrestDate: c.arrestDate,
        caseLatitude: c.latitude !== null && c.latitude !== undefined ? Number(c.latitude) : null,
        caseLongitude: c.longitude !== null && c.longitude !== undefined ? Number(c.longitude) : null,
        arrestLocationLatitude: arrestLocation?.latitude !== null && arrestLocation?.latitude !== undefined ? Number(arrestLocation.latitude) : null,
        arrestLocationLongitude: arrestLocation?.longitude !== null && arrestLocation?.longitude !== undefined ? Number(arrestLocation.longitude) : null,
        province: c.province,
        district: c.district,
        subdistrict: c.subdistrict,
        locationName: c.locationName,
        reportingUnitText: c.reportingUnitText,
        leadUnitText: c.leadUnitText,
        persons,
        seizedItems,
        participatingUnitCount: (participatingUnitsMap.get(c.id) ?? []).length,
        officerCount: (officersMap.get(c.id) ?? []).length,
        hasUnreviewedAlert: alerts.some((a) => a.status === "NEW"),
      };
    });

    // Section 14's drug-category filter: applied AFTER seizure facts are
    // resolved (it needs to inspect each case's seized items, which the
    // DrugCase-only repository query above cannot join) — matches
    // DrugCaseService.listCases's own post-filter shape for
    // participatingUnitCompanyId/officerId exactly.
    const filteredFacts = drugCategory ? caseFacts.filter((c) => c.seizedItems.some((item) => item.drugCategory === drugCategory)) : caseFacts;

    return composeDrugGeoResult(filteredFacts);
  }
}
