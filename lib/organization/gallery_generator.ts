/**
 * Gallery unit-name generator (static framework).
 *
 * Every Gallery unit-name dropdown/suggestion list should call
 * createGalleryUnitNames (or createGalleryDropdown for a ready-made
 * DropdownOption[]) instead of hardcoding a unit list — both derive names
 * straight from organization_master.ts via organization_generator.ts. Adding
 * or removing a unit means editing organization_master.ts only; every
 * Gallery type (org-chart, deployment-map, neighbor-map, ...) picks up the
 * change automatically, and no gallery duplicates its own company array —
 * each just supplies a prefix (Phase 27 Part 5/6/10).
 */

import type { DropdownOption } from "@/lib/organization/organization_types";
import { getCompanyNameOptions, getCompanyNameOptionsSpaced } from "@/lib/organization/organization_generator";
import { COMPANY_NUMBER_CODES } from "@/lib/organization/organization_master";

export interface GalleryDropdownParams {
  /** e.g. "ชปข./ชปส." or "แผนที่หน่วยข้างเคียง" — prepended to every company number. */
  prefix: string;
  /**
   * true inserts a space between prefix and number (for word/phrase prefixes,
   * e.g. "แผนที่หน่วยข้างเคียง 414"); false concatenates directly (for
   * prefixes that already end in a period, e.g. "ชปข./ชปส.414"). Default: false.
   */
  spaced?: boolean;
}

/**
 * Builds a Gallery unit-name dropdown for any prefix, e.g.
 * createGalleryDropdown({prefix: "ชปข./ชปส."}) -> [{value:"ชปข./ชปส.114", label:"ชปข./ชปส.114"}, ...]
 * createGalleryDropdown({prefix: "แผนผังวางกำลังพล", spaced: true}) -> [{value:"แผนผังวางกำลังพล 414", ...}, ...]
 */
export function createGalleryDropdown({ prefix, spaced = false }: GalleryDropdownParams): DropdownOption[] {
  const names = spaced ? getCompanyNameOptionsSpaced(prefix) : getCompanyNameOptions(prefix);
  return names.map((name) => ({ value: name, label: name }));
}

/**
 * Builds a plain unit-name string list for any prefix against any company
 * (number) code list — every Gallery type only ever needs to supply its own
 * prefix; the company list defaults to the full shared master-data list
 * (organization_master.ts's COMPANY_NUMBER_CODES) so a typical caller can
 * omit it entirely: createGalleryUnitNames("ชปข./ชปส.").
 *
 * Accepting an explicit companyList (rather than always using the full
 * dataset) lets a caller scope the generated names to a subset — e.g. only
 * the companies under one division — without ever hardcoding a duplicate
 * company array of its own; the subset must still come from
 * organization_master.ts/organization_generator.ts.
 */
export function createGalleryUnitNames(
  prefix: string,
  companyList: readonly string[] = COMPANY_NUMBER_CODES,
  options?: { spaced?: boolean }
): string[] {
  const spaced = options?.spaced ?? false;
  return companyList.map((code) => (spaced ? `${prefix} ${code}` : `${prefix}${code}`));
}
