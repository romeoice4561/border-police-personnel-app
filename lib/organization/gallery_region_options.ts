/**
 * Gallery-specific region options (Phase 26D Part 7).
 *
 * Gallery's Asset.region is a free-text field that may reference any region,
 * not only the 4 Border Patrol regions the shared organization framework
 * covers (organization_master.ts is Border Patrol Headquarters + Regions 1-4
 * only — see its docblock and README.md's "Border Patrol Only" note). This
 * file extends the framework's 4 Border Patrol regions with the additional
 * regions Gallery has historically allowed, without polluting the shared
 * Border Patrol master data with non-Border-Patrol regions.
 */

import type { DropdownOption } from "@/lib/organization/organization_types";
import { divisionDropdown } from "@/lib/organization/dropdown_options";

const NON_BORDER_PATROL_REGION_CODES = ["5", "6", "7"] as const;

/** Every Border Patrol region (1-4, from the shared framework) plus the additional non-Border-Patrol regions Gallery has historically offered (5-7). */
export const galleryRegionDropdown: readonly DropdownOption[] = [
  ...divisionDropdown,
  ...NON_BORDER_PATROL_REGION_CODES.map((code) => ({ value: code, label: `ภาค ${code}` })),
];
