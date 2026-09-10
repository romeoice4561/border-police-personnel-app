/**
 * DI-10E.6C — bounded one-case Map popup detail.
 *
 * Map-specific projection. Does not call the Case Workspace loader and does
 * not hydrate phones, devices, vehicles, identifiers, alerts, or narrative.
 * Query count is fixed (≤6) and does not grow with relation-row N.
 * Seized rows for the one case are fetched for grouping (safety cap 500);
 * overflow returns no partial group quantities.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugCaseNotFoundError } from "@/lib/drug_intelligence/drug_case_types";
import { DRUG_CASE_PERSON_ROLES, isValidDrugCasePersonRole } from "@/lib/drug_intelligence/drug_person_options";
import { isValidDrugCategory, isValidDrugMeasurementKind, type DrugCategory, type DrugMeasurementKind } from "@/lib/drug_intelligence/drug_seized_item_options";
import { groupSeizedItemFacts } from "@/lib/drug_intelligence/officer_drug_arrest_performance";
import type { DrugSeizedItemAnalyticsFacts } from "@/lib/drug_intelligence/drug_seized_item_analytics";

export const MAP_DETAIL_PERSON_CAP = 20;
export const MAP_DETAIL_SEIZURE_GROUP_CAP = 20;
export const MAP_DETAIL_SEIZED_ITEM_SAFETY_CAP = 500;
export const MAP_DETAIL_UNIT_CAP = 20;
export const MAP_DETAIL_MAX_DB_CALLS = 8;

const CASE_ID_SAFE = /^[A-Za-z0-9_-]{1,64}$/;

export class DrugMapCaseDetailInvalidIdError extends Error {
  constructor(message = "Invalid map case id") {
    super(message);
    this.name = "DrugMapCaseDetailInvalidIdError";
  }
}

export interface DrugMapCappedList<T> {
  items: T[];
  displayedCount: number;
  /** Exact total when known. Null when truncated via cap+1 and the true total is unknown. */
  totalCount: number | null;
  truncated: boolean;
}

export interface DrugMapCaseDetailPerson {
  personId: string;
  displayName: string;
  role: string;
}

export interface DrugMapCaseDetailSeizure {
  drugCategory: string;
  measurementKind: "COUNT" | "MASS";
  quantity: number | null;
  displayUnit: string | null;
  displayTh: string;
}

export interface DrugMapCaseDetailUnit {
  unitName: string;
}

export interface DrugMapCaseDetailResult {
  case: {
    id: string;
    caseNumber: string;
    arrestDate: string | null;
    status: string;
    province: string | null;
    district: string | null;
    locationName: string | null;
    reportingUnitText: string | null;
    leadUnitText: string | null;
  };
  persons: DrugMapCappedList<DrugMapCaseDetailPerson>;
  seizures: DrugMapCappedList<DrugMapCaseDetailSeizure>;
  participatingUnits: DrugMapCappedList<DrugMapCaseDetailUnit>;
  officers: { count: number };
}

function isoDate(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function roleRank(role: string): number {
  const index = (DRUG_CASE_PERSON_ROLES as readonly string[]).indexOf(role);
  return index === -1 ? DRUG_CASE_PERSON_ROLES.length : index;
}

function capList<T>(rows: T[], cap: number): DrugMapCappedList<T> {
  const truncated = rows.length > cap;
  const items = truncated ? rows.slice(0, cap) : rows;
  return {
    items,
    displayedCount: items.length,
    totalCount: truncated ? null : items.length,
    truncated,
  };
}

export function normalizeMapCaseDetailId(caseId: string): string {
  const trimmed = caseId.trim();
  if (!CASE_ID_SAFE.test(trimmed)) throw new DrugMapCaseDetailInvalidIdError();
  return trimmed;
}

export class DrugMapCaseDetailService {
  constructor(private readonly db: DatabaseClient) {}

  async load(rawCaseId: string): Promise<DrugMapCaseDetailResult> {
    const caseId = normalizeMapCaseDetailId(rawCaseId);
    const row = await this.db.drugCase.findUnique({ where: { id: caseId } });
    if (!row) throw new DrugCaseNotFoundError(caseId);

    const [personLinks, seizedRows, unitRows, officerCount] = await Promise.all([
      this.db.drugCasePerson.findMany({
        where: { caseId },
        orderBy: [{ role: "asc" }, { id: "asc" }],
        take: MAP_DETAIL_PERSON_CAP + 1,
      }),
      this.db.drugSeizedItem.findMany({
        where: { caseId },
        orderBy: [{ drugCategory: "asc" }, { measurementKind: "asc" }, { id: "asc" }],
        take: MAP_DETAIL_SEIZED_ITEM_SAFETY_CAP + 1,
        select: {
          drugCategory: true,
          otherDrugCategoryLabel: true,
          measurementKind: true,
          quantity: true,
          weightGrams: true,
          unit: true,
        },
      }),
      this.db.drugCaseParticipatingUnit.findMany({
        where: { caseId },
        orderBy: [{ unitText: "asc" }, { id: "asc" }],
        take: MAP_DETAIL_UNIT_CAP + 1,
        select: { unitText: true, id: true },
      }),
      this.db.drugCaseOfficer.count({ where: { caseId } }),
    ]);

    const personIds = [...new Set((personLinks as Array<{ personId: unknown }>).map((link) => String(link.personId)))];
    const personRows =
      personIds.length === 0
        ? []
        : await this.db.drugPerson.findMany({
            where: { id: { in: personIds } },
            select: { id: true, primaryFullName: true },
          });
    const nameById = new Map(
      (personRows as Array<{ id: unknown; primaryFullName?: unknown }>).map((person) => [String(person.id), textOrNull(person.primaryFullName) ?? "—"])
    );

    const persons = capList(
      (personLinks as Array<{ personId: unknown; role: unknown }>)
        .map((link) => {
          const role = String(link.role);
          return {
            personId: String(link.personId),
            displayName: nameById.get(String(link.personId)) ?? "—",
            role: isValidDrugCasePersonRole(role) ? role : "OTHER",
          };
        })
        .sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.displayName.localeCompare(b.displayName, "th") || a.personId.localeCompare(b.personId)),
      MAP_DETAIL_PERSON_CAP
    );

    const seizedFacts: DrugSeizedItemAnalyticsFacts[] = (seizedRows as Array<Record<string, unknown>>).flatMap((item) => {
      const drugCategory = String(item.drugCategory ?? "");
      const measurementKind = String(item.measurementKind ?? "");
      if (!isValidDrugCategory(drugCategory) || !isValidDrugMeasurementKind(measurementKind)) return [];
      return [
        {
          drugCategory: drugCategory as DrugCategory,
          otherDrugCategoryLabel: textOrNull(item.otherDrugCategoryLabel),
          measurementKind: measurementKind as DrugMeasurementKind,
          normalizedCount: measurementKind === "COUNT" && item.quantity != null ? Number(item.quantity) : null,
          normalizedWeightGrams: measurementKind === "MASS" && item.weightGrams != null ? Number(item.weightGrams) : null,
          displayUnit: textOrNull(item.unit),
        },
      ];
    });
    const rawSeizedOverflow = (seizedRows as unknown[]).length > MAP_DETAIL_SEIZED_ITEM_SAFETY_CAP;
    const grouped = rawSeizedOverflow
      ? []
      : groupSeizedItemFacts(seizedFacts)
          .map((group) => ({
            drugCategory: group.drugCategory,
            measurementKind: group.measurementKind,
            quantity: group.measurementKind === "COUNT" ? group.totalCount : group.totalWeightKilograms,
            displayUnit: group.measurementKind === "COUNT" ? group.displayUnit : "กก.",
            displayTh: group.displayTh,
          }))
          .sort(
            (a, b) =>
              a.drugCategory.localeCompare(b.drugCategory) ||
              a.measurementKind.localeCompare(b.measurementKind) ||
              (a.displayUnit ?? "").localeCompare(b.displayUnit ?? "")
          );
    const seizureItems = grouped.slice(0, MAP_DETAIL_SEIZURE_GROUP_CAP);
    const seizureTruncated = rawSeizedOverflow || grouped.length > MAP_DETAIL_SEIZURE_GROUP_CAP;
    const seizures: DrugMapCappedList<DrugMapCaseDetailSeizure> = {
      items: rawSeizedOverflow ? [] : seizureItems,
      displayedCount: rawSeizedOverflow ? 0 : seizureItems.length,
      totalCount: rawSeizedOverflow ? null : grouped.length,
      truncated: seizureTruncated,
    };

    const units = capList(
      (unitRows as Array<{ unitText?: unknown }>)
        .map((unit) => ({ unitName: textOrNull(unit.unitText) ?? "—" }))
        .sort((a, b) => a.unitName.localeCompare(b.unitName, "th")),
      MAP_DETAIL_UNIT_CAP
    );

    return {
      case: {
        id: String(row.id),
        caseNumber: String(row.caseNumber),
        arrestDate: isoDate(row.arrestDate),
        status: String(row.status),
        province: textOrNull(row.province),
        district: textOrNull(row.district),
        locationName: textOrNull(row.locationName),
        reportingUnitText: textOrNull(row.reportingUnitText),
        leadUnitText: textOrNull(row.leadUnitText),
      },
      persons,
      seizures,
      participatingUnits: units,
      officers: { count: Number(officerCount) || 0 },
    };
  }
}
