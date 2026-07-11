/**
 * Organization master data types (Phase 20A — Border Patrol Organization
 * Master Data Foundation).
 *
 * The authoritative Region → Battalion → Company hierarchy every future
 * module (Officers, Gallery, Portfolio, Awards, Training, Timeline,
 * Dashboards, Permissions) references by id instead of deriving unit
 * placement from loose folder/OCR text. Pure domain typing — no I/O, no OCR,
 * no AI, no DB.
 */

/** A region ("ภาค N"). `code` is the bare digit string, e.g. "4". */
export interface Region {
  id: number;
  code: string;
  nameTh: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** A battalion ("กก.ตชด.NN") under a region. `code` is the 2-digit string, e.g. "44". */
export interface Battalion {
  id: number;
  code: string;
  nameTh: string;
  regionId: number;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** A company ("ตชด.NNN") under a battalion. `code` is the 3-digit string, e.g. "447". */
export interface Company {
  id: number;
  code: string;
  nameTh: string;
  battalionId: number;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** A Company joined with its parent Battalion and Region — the common lookup shape. */
export interface CompanyWithAncestry extends Company {
  battalion: Battalion;
  region: Region;
}

/** Input row for seeding: one company plus the region/battalion codes it belongs to. */
export interface OrganizationSeedEntry {
  regionCode: string;
  regionNameTh: string;
  battalionCode: string;
  battalionNameTh: string;
  companyCode: string;
  companyNameTh: string;
}

/** Result of parsing a raw unit-reference string (e.g. from OCR/folder text) against the master hierarchy. */
export type OrganizationCodeResolution =
  | { status: "resolved"; level: "company"; companyCode: string; battalionCode: string; regionCode: string }
  | { status: "resolved"; level: "battalion"; battalionCode: string; regionCode: string }
  | { status: "resolved"; level: "region"; regionCode: string }
  | { status: "unresolved"; raw: string; reason: string };

/** A raw code that could not be confidently mapped to the master hierarchy — queued for manual review. */
export interface UnresolvedOrganizationCode {
  id: number;
  raw: string;
  reason: string;
  sourceModule: string;
  createdAt: string;
}

/**
 * Phase 27: a legacy/OCR-variant/unofficial text form that maps to a real,
 * still-registered Region/Battalion/Company — distinct from
 * UnresolvedOrganizationCode above (which is for text that maps to NOTHING).
 * Exactly one of regionId/battalionId/companyId is set, matching the level
 * the alias resolves to.
 */
export interface OrganizationAliasEntry {
  id: number;
  aliasText: string;
  regionId: number | null;
  battalionId: number | null;
  companyId: number | null;
  source: string;
  createdAt: string;
}

/**
 * Static framework types (organization_master.ts / organization_generator.ts
 * / dropdown_options.ts / gallery_generator.ts / organization_helpers.ts'
 * lookup functions).
 *
 * Named with a `Master` prefix to stay distinct from Region/Battalion/Company
 * above — those are DB row shapes for the editable, DB-backed hierarchy used
 * by Officer/Timeline's OrgHierarchyPicker. The types below describe the
 * plain hardcoded data in organization_master.ts and have no `id`/timestamps
 * because they are not database rows.
 */

/** The top-level headquarters ("บช.ตชด."). There is exactly one. */
export interface MasterOrganization {
  name: string;
  shortName: string;
}

/** A division ("ภาค N") in the static master hierarchy. */
export interface MasterDivision {
  code: string;
  name: string;
  battalionCodes: readonly string[];
}

/** A battalion ("กก.ตชด.NN") in the static master hierarchy. */
export interface MasterBattalion {
  code: string;
  name: string;
  divisionCode: string;
  companyCodes: readonly string[];
}

/** A company ("ร้อย ตชด.NNN") in the static master hierarchy. */
export interface MasterCompany {
  code: string;
  name: string;
  battalionCode: string;
  divisionCode: string;
}

/** The full division -> battalion -> company path for a given company code. */
export interface OrganizationPath {
  divisionCode: string;
  battalionCode: string;
  companyCode: string;
}

/** A single `<option>`-ready entry for any dropdown built from this framework. */
export interface DropdownOption {
  value: string;
  label: string;
}
