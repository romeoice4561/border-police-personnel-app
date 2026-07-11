/**
 * Gallery category -> unit-name prefix mapping (Phase 27 Part 6/7).
 *
 * Maps a Gallery AssetCategory to the prefix its generated unit names use,
 * so gallery_edit_modal.tsx's auto-fill (Part 7) can suggest the right
 * generated name for the asset being edited without hardcoding a duplicate
 * category->prefix table anywhere else. Every prefix here still only feeds
 * createGalleryUnitNames/createGalleryDropdown — no unit list is duplicated.
 */

import { AssetCategory } from "@/lib/gallery/asset_category";

export interface GalleryUnitNamePrefix {
  prefix: string;
  spaced: boolean;
}

/**
 * Category -> {prefix, spaced}, for the categories that have a defined
 * generated unit-name convention. A category not listed here (e.g.
 * CompanyLocation, BattalionLocation, Unknown) has no generated-name
 * convention and the auto-fill simply won't suggest one.
 */
const GALLERY_UNIT_NAME_PREFIXES: Partial<Record<AssetCategory, GalleryUnitNamePrefix>> = {
  [AssetCategory.OrgChart]: { prefix: "ชปข./ชปส.", spaced: false },
  [AssetCategory.DeploymentMap]: { prefix: "แผนผังวางกำลังพล", spaced: true },
  [AssetCategory.NeighborMap]: { prefix: "แผนที่หน่วยข้างเคียง", spaced: true },
};

/** The unit-name prefix/spacing convention for a category, or null if that category has no generated-name convention. */
export function unitNamePrefixForCategory(category: AssetCategory): GalleryUnitNamePrefix | null {
  return GALLERY_UNIT_NAME_PREFIXES[category] ?? null;
}
