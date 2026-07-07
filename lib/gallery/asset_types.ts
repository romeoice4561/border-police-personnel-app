/**
 * Asset model + query/list types (Phase 19A — Gallery Foundation).
 *
 * A reusable, source-neutral model for every non-profile visual asset
 * (neighbor maps, org charts, deployment maps, company/battalion location
 * maps, and any future visual asset). It carries ONLY discovery/metadata and
 * stored Drive image URLs — NO OCR fields, NO AI fields. This is the contract
 * the Asset repository/service/API/Gallery UI all speak.
 *
 * Pure domain typing — no I/O, no DB, no OCR/AI imports.
 */

import type { AssetCategory } from "@/lib/gallery/asset_category";

/**
 * One Gallery asset. `assetId` is deterministic (derived from the Drive file
 * id / relative path) so re-discovery is idempotent. Image URLs are the stored,
 * derived Drive URLs (reused from the officer-photo layer) — rendering never
 * calls a Google API.
 */
export interface Asset {
  /** Deterministic id (see asset_builder — from driveFileId, else relativePath). */
  assetId: string;
  category: AssetCategory;
  /** Organizational placement, parsed from the folder hierarchy (never OCR). */
  region: string | null;
  company: string | null;
  battalion: string | null;
  /** The top-level (semantic) folder the asset was discovered under. */
  folderName: string | null;
  /** Full path of the file relative to the scan root. */
  relativePath: string;
  /** Google Drive identity + stored image URLs (no re-download, no API call). */
  driveFileId: string | null;
  thumbnailUrl: string | null;
  webViewUrl: string | null;
  /** Optional intrinsic dimensions, when known (never required; no OCR). */
  imageWidth?: number | null;
  imageHeight?: number | null;
  /** Drive timestamps (ISO strings), when available. */
  createdTime: string | null;
  updatedTime: string | null;
  /**
   * Phase 20B: optional link to the Organization master data (Phase 20A),
   * resolved from `company` at import time. Null when unresolved (no
   * registered Company matched) or not yet resolved — `company`/`battalion`/
   * `region` text remain authoritative regardless of this field.
   */
  companyId?: number | null;
  /**
   * Phase 22A: user-editable metadata. All optional so existing assets
   * (without these columns populated) remain valid without back-fill.
   */
  unitName?:    string | null;
  unitNumber?:  string | null;
  /** Keywords exposed as a string array; stored comma-joined in the DB. */
  keywords?:    string[];
  description?: string | null;
  remarks?:     string | null;
  verified?:    boolean;
}

/**
 * Phase 22A: the fields a user may patch via the metadata editor.
 * Only provided keys are updated; omitted keys are left unchanged.
 * Explicit `null` clears a field.
 */
export interface AssetMetadataPatch {
  region?:      string | null;
  battalion?:   string | null;
  company?:     string | null;
  unitName?:    string | null;
  unitNumber?:  string | null;
  keywords?:    string[];
  description?: string | null;
  remarks?:     string | null;
  verified?:    boolean;
}

/** Fields required to build/persist an asset (everything derivable at discovery). */
export type AssetInput = Asset;

/** Text match modes for asset text filters (mirrors the officer API's modes). */
export type AssetMatchMode = "contains" | "startsWith" | "exact";

/** Sortable asset fields (whitelisted — never a raw caller column). */
export type AssetSortField = "folderName" | "region" | "company" | "createdTime" | "updatedTime";

/** Filter/query parameters for listing assets. All optional; provided fields AND-combine. */
export interface AssetQuery {
  category?: AssetCategory;
  region?: string;
  company?: string;
  battalion?: string;
  /** Phase 20B: filter by the resolved Organization master-data Company id. */
  companyId?: number;
  /** Free-text match against folderName / relativePath / keywords / etc. */
  search?: string;
  match?: AssetMatchMode;
  /** Phase 22A: when set, only return assets with this verification state. */
  verified?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: AssetSortField;
  sortOrder?: "asc" | "desc";
}

/** A page of assets plus pagination metadata (mirrors the officer API's shape). */
export interface PaginatedAssets {
  data: Asset[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** A category with its asset count — for the Gallery's category filter/summary. */
export interface AssetCategoryCount {
  category: AssetCategory;
  count: number;
}

/** A facet value with its count — for the region/company filters. */
export interface AssetFacetCount {
  value: string;
  count: number;
}
