/**
 * Gallery unit-name generator.
 *
 * Every Gallery unit-name dropdown/suggestion list should call
 * createGalleryUnitNames (or createGalleryDropdown for a ready-made
 * DropdownOption[]) instead of hardcoding a unit list. Both are pure string
 * formatters — prefix + company code — with NO organization dataset of
 * their own; the caller supplies the company code list, which should always
 * come from the shared OrganizationEngine (e.g.
 * `engine.getCompanies(battalionId).map(c => c.code)`), the same DB-backed
 * source every other screen reads from (Phase 27: "the database is
 * authoritative"). No gallery duplicates its own company array — each just
 * supplies a prefix and the engine-derived code list (Phase 27 Part 5/6/10).
 */

import type { DropdownOption } from "@/lib/organization/organization_types";
import { getCompanyNameOptions, getCompanyNameOptionsSpaced } from "@/lib/organization/organization_generator";

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
 *
 * @deprecated Uses organization_generator.ts's full static company list —
 * prefer createGalleryUnitNames with an explicit engine-derived companyList
 * so the dropdown reflects the live DB hierarchy, not the static bootstrap
 * dataset. Kept for callers that genuinely want every company regardless of
 * DB state.
 */
export function createGalleryDropdown({ prefix, spaced = false }: GalleryDropdownParams): DropdownOption[] {
  const names = spaced ? getCompanyNameOptionsSpaced(prefix) : getCompanyNameOptions(prefix);
  return names.map((name) => ({ value: name, label: name }));
}

/**
 * Builds a plain unit-name string list for any prefix against an explicit
 * company (number) code list — every Gallery type only ever needs to supply
 * its own prefix plus the codes it wants named, e.g.
 * `createGalleryUnitNames("ชปข./ชปส.", engine.getCompanies().map(c => c.code))`.
 * `companyList` is REQUIRED (Phase 27) so this never silently falls back to
 * a static dataset that could disagree with the live DB — the caller always
 * states explicitly which codes it means.
 */
export function createGalleryUnitNames(prefix: string, companyList: readonly string[], options?: { spaced?: boolean }): string[] {
  const spaced = options?.spaced ?? false;
  return companyList.map((code) => (spaced ? `${prefix} ${code}` : `${prefix}${code}`));
}
