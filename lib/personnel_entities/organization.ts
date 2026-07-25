/**
 * Organization entity catalog built from OrgTree (Phase 51.1A).
 * Separates publicCode from internal numeric ids.
 */
import type { OrgTree } from "@/lib/organization/org_tree";
import { divisionLabelForRegion } from "@/lib/organization/border_patrol_division_options";
import {
  companyAliasesForCode,
  divisionAliasesForCode,
  regionAliasesForCode,
  buildAliasIndex,
  normalizeAliasKey,
} from "@/lib/personnel_entities/aliases";
import type { OrgEntityRecord } from "@/lib/personnel_entities/contracts";
import type { OrganizationEntityType } from "@/lib/personnel_entities/types";

export interface OrgEntityCatalog {
  records: readonly OrgEntityRecord[];
  /** Normalized alias → record indices (ambiguity when length > 1). */
  aliasIndex: ReadonlyMap<string, readonly number[]>;
  byInternalId: ReadonlyMap<string, OrgEntityRecord>;
  byPublicCode: ReadonlyMap<string, OrgEntityRecord>;
}

function recordKey(type: OrganizationEntityType, internalId: number): string {
  return `${type}:${internalId}`;
}

function publicKey(type: OrganizationEntityType, publicCode: string): string {
  return `${type}:${publicCode}`;
}

/** Build a pure in-memory catalog from an OrgTree snapshot. */
export function buildOrgEntityCatalog(tree: OrgTree | null | undefined): OrgEntityCatalog {
  if (!tree) {
    return {
      records: [],
      aliasIndex: new Map(),
      byInternalId: new Map(),
      byPublicCode: new Map(),
    };
  }

  const records: OrgEntityRecord[] = [];

  for (const region of tree.regions) {
    const displayName = divisionLabelForRegion(region);
    records.push({
      type: "region",
      internalId: region.id,
      publicCode: region.code,
      displayName,
      aliases: regionAliasesForCode(region.code, displayName),
      parentInternalId: region.headquartersId,
    });
  }

  for (const battalion of tree.battalions) {
    records.push({
      type: "division",
      internalId: battalion.id,
      publicCode: battalion.code,
      displayName: battalion.nameTh,
      aliases: divisionAliasesForCode(battalion.code, battalion.nameTh),
      parentInternalId: battalion.regionId,
    });
  }

  for (const company of tree.companies) {
    records.push({
      type: "company",
      internalId: company.id,
      publicCode: company.code,
      displayName: company.nameTh,
      aliases: companyAliasesForCode(company.code, company.nameTh),
      parentInternalId: company.battalionId,
    });
  }

  const byInternalId = new Map<string, OrgEntityRecord>();
  const byPublicCode = new Map<string, OrgEntityRecord>();
  for (const record of records) {
    byInternalId.set(recordKey(record.type, record.internalId), record);
    byPublicCode.set(publicKey(record.type, record.publicCode), record);
  }

  return {
    records,
    aliasIndex: buildAliasIndex(records),
    byInternalId,
    byPublicCode,
  };
}

export function lookupOrgByPublicCode(
  catalog: OrgEntityCatalog,
  type: OrganizationEntityType,
  publicCode: string
): OrgEntityRecord | null {
  return catalog.byPublicCode.get(publicKey(type, publicCode.trim())) ?? null;
}

export function lookupOrgByInternalId(
  catalog: OrgEntityCatalog,
  type: OrganizationEntityType,
  internalId: number
): OrgEntityRecord | null {
  return catalog.byInternalId.get(recordKey(type, internalId)) ?? null;
}

export function lookupOrgByAlias(
  catalog: OrgEntityCatalog,
  raw: string
): OrgEntityRecord[] {
  const key = normalizeAliasKey(raw);
  if (!key) return [];
  const indices = catalog.aliasIndex.get(key) ?? [];
  return indices.map((i) => catalog.records[i]).filter(Boolean);
}

/** Prefer most specific organization type when multiple records match. */
export function preferMostSpecificOrg(records: readonly OrgEntityRecord[]): OrgEntityRecord[] {
  const rank: Record<OrganizationEntityType, number> = { company: 3, division: 2, region: 1 };
  if (records.length <= 1) return [...records];
  const max = Math.max(...records.map((r) => rank[r.type]));
  return records.filter((r) => rank[r.type] === max);
}
