/**
 * Gallery-specific region options (Phase 27).
 *
 * Gallery's Asset.region is a free-text field that may reference any region,
 * not only the Border Patrol regions the shared OrganizationEngine covers
 * (the engine's DB-backed Region table is Border Patrol Regions 1-4 only —
 * see README.md's "Border Patrol Only" note). This file extends the
 * engine's regions with the additional regions Gallery has historically
 * allowed, without polluting the shared Border Patrol master data with
 * non-Border-Patrol regions.
 *
 * Takes the engine as a parameter (rather than a module-level constant
 * computed from the static bootstrap file) so this always reflects the
 * live DB regions, per Phase 27's "switching from static bootstrap data to
 * live database data requires no UI changes."
 */

import type { DropdownOption } from "@/lib/organization/organization_types";
import type { OrganizationEngine } from "@/lib/organization/organization_engine";

const NON_BORDER_PATROL_REGION_CODES = ["5", "6", "7"] as const;

/** Every Border Patrol region (from the shared engine) plus the additional non-Border-Patrol regions Gallery has historically offered (5-7). */
export function galleryRegionOptions(engine: OrganizationEngine): readonly DropdownOption[] {
  return [
    ...engine.getRegionOptions(),
    ...NON_BORDER_PATROL_REGION_CODES.map((code) => ({ value: code, label: `ภาค ${code}` })),
  ];
}
