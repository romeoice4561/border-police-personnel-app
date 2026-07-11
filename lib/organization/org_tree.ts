/**
 * Organization tree — client-safe snapshot + auto-fill (Phase 26B Part C/D).
 *
 * The whole Headquarters -> Region ("Border Patrol Division") -> Battalion
 * -> Company hierarchy is small (≈30 + 4 + 16 + 72 rows) and changes rarely,
 * so it is fetched ONCE server-side (see getOrgTree in
 * lib/server/org_tree_service.ts) and handed to the client as a flat,
 * pre-joined snapshot — no per-keystroke API calls, no N+1 lookups while
 * typing in a combobox. This module is the PURE (no I/O) shape + auto-fill
 * logic, shared by the server loader and the client editor, and fully
 * unit-testable without a database.
 */

import { divisionLabelForRegion } from "@/lib/organization/border_patrol_division_options";

export interface OrgTreeHeadquarters {
  id: number;
  code: string;
  nameTh: string;
}

export interface OrgTreeRegion {
  id: number;
  code: string;
  nameTh: string;
  headquartersId: number | null;
}

export interface OrgTreeBattalion {
  id: number;
  code: string;
  nameTh: string;
  regionId: number;
}

export interface OrgTreeCompany {
  id: number;
  code: string;
  nameTh: string;
  battalionId: number;
}

/** The full flat snapshot — every row from every level, joined only by foreign key id (no nesting, easy to filter client-side). */
export interface OrgTree {
  headquarters: OrgTreeHeadquarters[];
  regions: OrgTreeRegion[];
  battalions: OrgTreeBattalion[];
  companies: OrgTreeCompany[];
}

export const EMPTY_ORG_TREE: OrgTree = { headquarters: [], regions: [], battalions: [], companies: [] };

/** The 4 org-hierarchy ids a Timeline row (or the auto-fill result) carries. */
export interface OrgSelection {
  headquartersId: number | null;
  regionId: number | null;
  battalionId: number | null;
  companyId: number | null;
}

export const EMPTY_ORG_SELECTION: OrgSelection = { headquartersId: null, regionId: null, battalionId: null, companyId: null };

export function battalionsForRegion(tree: OrgTree, regionId: number | null): OrgTreeBattalion[] {
  if (regionId === null) return [];
  return tree.battalions.filter((b) => b.regionId === regionId);
}

export function companiesForBattalion(tree: OrgTree, battalionId: number | null): OrgTreeCompany[] {
  if (battalionId === null) return [];
  return tree.companies.filter((c) => c.battalionId === battalionId);
}

/**
 * Part D — Smart Auto Fill: given a selected Company, derives its full
 * ancestry (Battalion -> Region -> Headquarters) from the tree. Returns
 * EMPTY_ORG_SELECTION when the company id isn't found (never guesses).
 * Symmetric helpers below do the same starting from a Battalion or Region,
 * so selecting at ANY level auto-fills everything above it.
 */
export function autoFillFromCompany(tree: OrgTree, companyId: number | null): OrgSelection {
  if (companyId === null) return EMPTY_ORG_SELECTION;
  const company = tree.companies.find((c) => c.id === companyId);
  if (!company) return EMPTY_ORG_SELECTION;
  const fromBattalion = autoFillFromBattalion(tree, company.battalionId);
  return { ...fromBattalion, companyId: company.id };
}

export function autoFillFromBattalion(tree: OrgTree, battalionId: number | null): OrgSelection {
  if (battalionId === null) return EMPTY_ORG_SELECTION;
  const battalion = tree.battalions.find((b) => b.id === battalionId);
  if (!battalion) return EMPTY_ORG_SELECTION;
  const fromRegion = autoFillFromRegion(tree, battalion.regionId);
  return { ...fromRegion, battalionId: battalion.id, companyId: null };
}

export function autoFillFromRegion(tree: OrgTree, regionId: number | null): OrgSelection {
  if (regionId === null) return EMPTY_ORG_SELECTION;
  const region = tree.regions.find((r) => r.id === regionId);
  if (!region) return EMPTY_ORG_SELECTION;
  return { headquartersId: region.headquartersId, regionId: region.id, battalionId: null, companyId: null };
}

/** Display labels resolved from an OrgSelection's ids, or null per level when unset/unresolved (never invented). */
export interface OrgLabels {
  headquarters: string | null;
  /** The Border Patrol Division combobox's friendly label ("ตชด.ภ.4"), not the raw Region.nameTh. */
  borderPatrolDivision: string | null;
  battalion: string | null;
  company: string | null;
}

/**
 * Resolves an officer/timeline row's org-hierarchy ids against the tree into
 * display labels — the single place this lookup lives, shared by every
 * read-only viewer (Part F's timeline viewer, Part C/I's Current
 * Organization section) so they never hand-roll their own `tree.x.find(...)`.
 */
export function resolveOrgLabels(tree: OrgTree, selection: OrgSelection): OrgLabels {
  const headquarters = selection.headquartersId != null ? tree.headquarters.find((h) => h.id === selection.headquartersId) : undefined;
  const region = selection.regionId != null ? tree.regions.find((r) => r.id === selection.regionId) : undefined;
  const battalion = selection.battalionId != null ? tree.battalions.find((b) => b.id === selection.battalionId) : undefined;
  const company = selection.companyId != null ? tree.companies.find((c) => c.id === selection.companyId) : undefined;
  return {
    headquarters: headquarters?.nameTh ?? null,
    borderPatrolDivision: region ? divisionLabelForRegion(region) : null,
    battalion: battalion?.nameTh ?? null,
    company: company?.nameTh ?? null,
  };
}
