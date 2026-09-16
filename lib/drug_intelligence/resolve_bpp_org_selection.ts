/**
 * Maps a BPP master-list selection onto existing OrganizationEngine records
 * when labels/codes already exist. Never creates organization rows. Display
 * text stays the exact master-list label even when the DB name differs
 * (seeded companies are often "ตชด.414" while the master list uses
 * "ร้อย ตชด.414").
 */

import {
  bppBattalionCodeFromLabel,
  bppCompanyCodeFromLabel,
  bppRegionCodeFromLabel,
} from "@/lib/drug_intelligence/bpp_unit_master";
import type { OrganizationEngine } from "@/lib/organization/organization_engine";
import type { OrgSelection } from "@/lib/organization/org_tree";

export interface BppOrgSelection extends OrgSelection {
  headquartersText: string;
  regionText: string;
  battalionText: string;
  companyText: string;
}

export function emptyOrgHierarchyValue(): BppOrgSelection {
  return {
    headquartersId: null,
    headquartersText: "",
    regionId: null,
    regionText: "",
    battalionId: null,
    battalionText: "",
    companyId: null,
    companyText: "",
  };
}

function headquartersTextFor(engine: OrganizationEngine, headquartersId: number | null): string {
  if (headquartersId === null) return "";
  return engine.getOrganizationTree().headquarters.find((h) => h.id === headquartersId)?.nameTh ?? "";
}

function resolveCompany(engine: OrganizationEngine, companyText: string) {
  const needle = companyText.trim();
  if (!needle) return null;
  const companies = engine.getCompanies();
  const exact = companies.find((c) => c.nameTh === needle);
  if (exact) return exact;
  const withoutCompanyPrefix = needle.replace(/^ร้อย\s+/, "");
  const shortName = companies.find((c) => c.nameTh === withoutCompanyPrefix);
  if (shortName) return shortName;
  const code = bppCompanyCodeFromLabel(needle);
  return code ? engine.getCompanyByCode(code) : null;
}

function resolveBattalion(engine: OrganizationEngine, battalionText: string) {
  const needle = battalionText.trim();
  if (!needle) return null;
  const exact = engine.getBattalions().find((b) => b.nameTh === needle);
  if (exact) return exact;
  const code = bppBattalionCodeFromLabel(needle);
  return code ? engine.getBattalionByCode(code) : null;
}

function resolveRegion(engine: OrganizationEngine, regionText: string) {
  const needle = regionText.trim();
  if (!needle) return null;
  const tree = engine.getOrganizationTree();
  const exact = tree.regions.find((r) => r.nameTh === needle);
  if (exact) return exact;
  const code = bppRegionCodeFromLabel(needle);
  return code ? engine.getRegionByCode(code) : null;
}

/**
 * Keep the operator's master-list labels. Fill canonical ids only when an
 * existing org-tree row matches — unmatched text is still persisted as
 * reporting/lead/participating unit text, never as a new org record.
 */
export function resolveBppOrgSelection(
  engine: OrganizationEngine | undefined,
  labels: { regionText: string; battalionText: string; companyText: string }
): BppOrgSelection {
  const regionText = labels.regionText.trim();
  const battalionText = labels.battalionText.trim();
  const companyText = labels.companyText.trim();
  const next: BppOrgSelection = {
    ...emptyOrgHierarchyValue(),
    regionText,
    battalionText,
    companyText,
  };
  if (!engine) return next;

  if (companyText) {
    const company = resolveCompany(engine, companyText);
    if (company) {
      const filled = engine.cascade.fromCompany(company.id);
      return {
        ...next,
        ...filled,
        regionText,
        battalionText,
        companyText,
        headquartersText: headquartersTextFor(engine, filled.headquartersId),
      };
    }
  }

  if (battalionText) {
    const battalion = resolveBattalion(engine, battalionText);
    if (battalion) {
      const filled = engine.cascade.fromBattalion(battalion.id);
      return {
        ...next,
        ...filled,
        regionText,
        battalionText,
        companyText,
        headquartersText: headquartersTextFor(engine, filled.headquartersId),
      };
    }
  }

  if (regionText) {
    const region = resolveRegion(engine, regionText);
    if (region) {
      const filled = engine.cascade.fromRegion(region.id);
      return {
        ...next,
        ...filled,
        regionText,
        battalionText,
        companyText,
        headquartersText: headquartersTextFor(engine, filled.headquartersId),
      };
    }
  }

  return next;
}

export function participatingUnitHasSelection(unit: {
  useManualUnit: boolean;
  manualUnitText: string;
  headquartersId: number | null;
  regionId: number | null;
  battalionId: number | null;
  companyId: number | null;
  headquartersText: string;
  regionText: string;
  battalionText: string;
  companyText: string;
}): boolean {
  if (unit.useManualUnit) return unit.manualUnitText.trim().length > 0;
  return Boolean(
    unit.headquartersId ||
      unit.regionId ||
      unit.battalionId ||
      unit.companyId ||
      unit.headquartersText.trim() ||
      unit.regionText.trim() ||
      unit.battalionText.trim() ||
      unit.companyText.trim()
  );
}
