/**
 * Gallery organization text helpers (Phase 27).
 *
 * Gallery's Region/Battalion/Company fields (Asset.region/battalion/company)
 * are free-text labels, not id-linked like Officer/Timeline's
 * OrgHierarchyPicker (which cascades via OrganizationEngine.cascade using
 * ids). These helpers give Gallery's Combobox fields the same cascading/
 * auto-fill BEHAVIOR, resolved from label text against the SAME
 * OrganizationEngine every other screen reads from — no separate/duplicated
 * organization dataset. This is a thin text<->id adapter over the engine,
 * not an independent implementation: every lookup here ultimately calls
 * OrganizationEngine methods (getRegionOptions/getBattalionOptions/
 * getCompanyOptions/cascade), it just also knows how to parse Gallery's
 * plain-string field values back into the ids the engine's sync API expects.
 */

import type { OrganizationEngine } from "@/lib/organization/organization_engine";

/** Extracts the bare company number (e.g. "416") from a company label (e.g. "ร้อย ตชด.416"), or null if it isn't a recognized company. */
export function companyCodeFromLabel(engine: OrganizationEngine, label: string): string | null {
  const match = label.match(/(\d{3})/);
  if (!match) return null;
  const code = match[1];
  return engine.getCompanyByCode(code) ? code : null;
}

/** Extracts the bare battalion number (e.g. "44") from a battalion label (e.g. "กก.ตชด.44"), or null if it isn't a recognized battalion. */
export function battalionCodeFromLabel(engine: OrganizationEngine, label: string): string | null {
  const match = label.match(/(\d{2})/);
  if (!match) return null;
  const code = match[1];
  return engine.getBattalionByCode(code) ? code : null;
}

/**
 * Extracts the bare division/region number (e.g. "4") from a region label —
 * ONLY on an EXACT match against a canonical region label/code/nameTh (e.g.
 * "ตชด.ภาค 4", "ภาค 4", or the bare code "4" itself), never by grabbing "the
 * first digit anywhere in the string" (Phase 27 Bug #3 fix). A regexp-style
 * "first digit wins" match previously misresolved arbitrary/legacy Gallery
 * region text (which is free text, not an id) to the wrong region purely
 * because its first character happened to be a matching digit — e.g. any
 * text starting with "1" silently resolved to Region 1 regardless of intent.
 * Returns null (never guesses) for anything that isn't an exact canonical
 * match — callers must treat null as "unresolved," not "assume region 1."
 */
export function divisionCodeFromLabel(engine: OrganizationEngine, label: string): string | null {
  const needle = label.trim();
  if (!needle) return null;
  for (const region of engine.getRegions()) {
    if (region.code === needle || region.nameTh === needle) return region.code;
  }
  for (const option of engine.getRegionOptions()) {
    if (option.label === needle) {
      const region = engine.getRegions().find((r) => String(r.id) === option.value);
      if (region) return region.code;
    }
  }
  return null;
}

/** Battalion label suggestions scoped to a region (by its EXACT label text — Bug #3), or every battalion when the region text doesn't exactly resolve to a known Border Patrol division (safe default: never guesses a wrong region from partial/unresolved text). */
export function battalionLabelsForRegion(engine: OrganizationEngine, regionLabel: string): readonly string[] {
  const region = divisionCodeFromLabel(engine, regionLabel);
  const regionRow = region ? engine.getRegionByCode(region) : null;
  const battalions = regionRow ? engine.getBattalions(regionRow.id) : engine.getBattalions();
  return battalions.map((b) => b.nameTh);
}

/** Company label suggestions scoped to a battalion (by its label text), or every company when the battalion doesn't resolve to a known Border Patrol battalion. */
export function companyLabelsForBattalion(engine: OrganizationEngine, battalionLabel: string): readonly string[] {
  const battalionCode = battalionCodeFromLabel(engine, battalionLabel);
  const battalionRow = battalionCode ? engine.getBattalionByCode(battalionCode) : null;
  const companies = battalionRow ? engine.getCompanies(battalionRow.id) : engine.getCompanies();
  return companies.map((c) => c.nameTh);
}

export interface CompanyAutoFill {
  companyNumber: string;
  battalionLabel: string;
  divisionCode: string;
}

/** Given a selected company label, derives its bare unit number and ancestor battalion label — for auto-filling Unit Number / re-deriving the Battalion Combobox (Part 7). Returns null when the company doesn't resolve against the engine's hierarchy. */
export function autoFillFromCompanyLabel(engine: OrganizationEngine, companyLabel: string): CompanyAutoFill | null {
  const companyNumber = companyCodeFromLabel(engine, companyLabel);
  if (!companyNumber) return null;
  const company = engine.getCompanyByCode(companyNumber);
  if (!company) return null;
  const filled = engine.cascade.fromCompany(company.id);
  const battalion = filled.battalionId != null ? engine.getBattalions().find((b) => b.id === filled.battalionId) : null;
  const region = filled.regionId != null ? engine.getRegions().find((r) => r.id === filled.regionId) : null;
  if (!battalion || !region) return null;
  return { companyNumber, battalionLabel: battalion.nameTh, divisionCode: region.code };
}
