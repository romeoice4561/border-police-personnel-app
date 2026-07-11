/**
 * Ready-to-use dropdown option arrays (static framework).
 *
 * Thin `{value, label}` wrappers around organization_master.ts and
 * organization_generator.ts, so a component never has to build its own
 * option list — it imports the array it needs and renders it directly.
 * Every array here is derived, not hardcoded; adding units means editing
 * organization_master.ts only.
 */

import type { DropdownOption } from "@/lib/organization/organization_types";
import { HEADQUARTERS_SHORT_NAME, DIVISION_CODES, BATTALION_CODES, COMPANY_NUMBER_CODES } from "@/lib/organization/organization_master";
import { getBattalionOptions, getCompanyOptions } from "@/lib/organization/organization_generator";

/** The single headquarters option — included for dropdowns that offer "all levels" as choices. */
export const headquartersDropdown: readonly DropdownOption[] = [{ value: HEADQUARTERS_SHORT_NAME, label: HEADQUARTERS_SHORT_NAME }];

/** "ภาค N" for every division, value = bare code. */
export const divisionDropdown: readonly DropdownOption[] = DIVISION_CODES.map((code) => ({
  value: code,
  label: `ภาค ${code}`,
}));

/** Alias of divisionDropdown — "Region" is the term used elsewhere in the app for this same level. */
export const regionDropdown: readonly DropdownOption[] = divisionDropdown;

/** "กก.ตชด.NN" for every battalion, value = bare code. */
export const battalionDropdown: readonly DropdownOption[] = BATTALION_CODES.map((code, i) => ({
  value: code,
  label: getBattalionOptions()[i],
}));

/** "ร้อย ตชด.NNN" for every company, value = bare code. */
export const companyDropdown: readonly DropdownOption[] = COMPANY_NUMBER_CODES.map((code, i) => ({
  value: code,
  label: getCompanyOptions()[i],
}));

/** Bare 3-digit company numbers, value === label. */
export const companyNumberDropdown: readonly DropdownOption[] = COMPANY_NUMBER_CODES.map((code) => ({
  value: code,
  label: code,
}));
