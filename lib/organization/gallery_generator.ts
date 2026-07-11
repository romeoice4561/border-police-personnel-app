/**
 * Gallery dropdown generator (static framework).
 *
 * Every Gallery unit-name dropdown should call createGalleryDropdown instead
 * of hardcoding a unit list — it derives {value, label} options straight
 * from organization_master.ts via organization_generator.ts. Adding/removing
 * a unit means editing organization_master.ts only; Gallery picks it up with
 * no code change.
 */

import type { DropdownOption } from "@/lib/organization/organization_types";
import { getCompanyNameOptions, getCompanyNameOptionsSpaced } from "@/lib/organization/organization_generator";

export interface GalleryDropdownParams {
  /** e.g. "ชปข." or "แผนที่หน่วยข้างเคียง" — prepended to every company number. */
  prefix: string;
  /**
   * true inserts a space between prefix and number (for word/phrase prefixes,
   * e.g. "แผนที่หน่วยข้างเคียง 414"); false concatenates directly (for
   * prefixes that already end in a period, e.g. "ชปข.414"). Default: false.
   */
  spaced?: boolean;
}

/**
 * Builds a Gallery unit-name dropdown for any prefix, e.g.
 * createGalleryDropdown({prefix: "ชปข."}) -> [{value:"ชปข.114", label:"ชปข.114"}, ...]
 * createGalleryDropdown({prefix: "แผนผังวางกำลังพล", spaced: true}) -> [{value:"แผนผังวางกำลังพล 414", ...}, ...]
 */
export function createGalleryDropdown({ prefix, spaced = false }: GalleryDropdownParams): DropdownOption[] {
  const names = spaced ? getCompanyNameOptionsSpaced(prefix) : getCompanyNameOptions(prefix);
  return names.map((name) => ({ value: name, label: name }));
}
