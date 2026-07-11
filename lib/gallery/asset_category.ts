/**
 * AssetCategory (Phase 19A — Gallery Foundation).
 *
 * The Gallery domain's category for a visual asset. It is a superset-aligned
 * mirror of the Drive router's DriveContentType, kept as its OWN enum so the
 * Gallery layer is decoupled from the scanner (it can gain categories, or be
 * fed from a non-Drive source, without touching the router). PROFILE is
 * reserved: profile images belong to the officer-extraction pipeline, never the
 * Gallery, so the Gallery service excludes it — but the value exists so the
 * mapping from DriveContentType is total and lossless.
 *
 * Pure domain typing — no OCR, no AI, no I/O, no DB.
 */

import { DriveContentType } from "@/lib/google-drive/drive_content_type";

/** Category of a Gallery asset. Mirrors DriveContentType; PROFILE is reserved (not a Gallery category). */
export enum AssetCategory {
  /** Reserved — personnel profiles are handled by the officer pipeline, not the Gallery. */
  Profile = "PROFILE",
  NeighborMap = "NEIGHBOR_MAP",
  OrgChart = "ORG_CHART",
  DeploymentMap = "DEPLOYMENT_MAP",
  CompanyLocation = "COMPANY_LOCATION",
  BattalionLocation = "BATTALION_LOCATION",
  Unknown = "UNKNOWN",
}

/** Every non-reserved category — i.e. the categories the Gallery actually serves. */
export const GALLERY_CATEGORIES: readonly AssetCategory[] = [
  AssetCategory.NeighborMap,
  AssetCategory.OrgChart,
  AssetCategory.DeploymentMap,
  AssetCategory.CompanyLocation,
  AssetCategory.BattalionLocation,
  AssetCategory.Unknown,
];

/** Maps the Drive router's content type to a Gallery AssetCategory (total, lossless). */
export function assetCategoryFromContentType(contentType: DriveContentType): AssetCategory {
  switch (contentType) {
    case DriveContentType.Profile:
      return AssetCategory.Profile;
    case DriveContentType.NeighborMap:
      return AssetCategory.NeighborMap;
    case DriveContentType.OrgChart:
      return AssetCategory.OrgChart;
    case DriveContentType.DeploymentMap:
      return AssetCategory.DeploymentMap;
    case DriveContentType.CompanyLocation:
      return AssetCategory.CompanyLocation;
    case DriveContentType.BattalionLocation:
      return AssetCategory.BattalionLocation;
    case DriveContentType.Unknown:
    default:
      return AssetCategory.Unknown;
  }
}

/** True when a category is PROFILE — reserved for the officer pipeline, excluded from the Gallery. */
export function isReservedCategory(category: AssetCategory): boolean {
  return category === AssetCategory.Profile;
}

/** True when a category is a real Gallery category (everything except the reserved PROFILE). */
export function isGalleryCategory(category: AssetCategory): boolean {
  return !isReservedCategory(category);
}

/** Human-readable labels for the UI — official Thai folder names (Phase 19F). */
export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  [AssetCategory.Profile]: "ข้อมูลบุคคล",
  [AssetCategory.NeighborMap]: "แผนที่หน่วยข้างเคียง",
  [AssetCategory.OrgChart]: "โครงสร้างชุด ชปข./ชปส.",
  [AssetCategory.DeploymentMap]: "แผนผังการวางกำลัง",
  [AssetCategory.CompanyLocation]: "แผนที่ตั้งกองร้อย",
  [AssetCategory.BattalionLocation]: "แผนที่ตั้ง กองกำกับ ตชด.",
  [AssetCategory.Unknown]: "อื่น ๆ",
};
