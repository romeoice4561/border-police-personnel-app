/**
 * GalleryImporter (Phase 19B — Gallery Persistence).
 *
 * Consumes Drive DISCOVERY entries (DriveScanEntry) and persists the non-profile
 * ones as Gallery assets:
 *
 *   DriveScanEntry[]  → (ignore PROFILE + non-images)
 *                     → AssetBuilder (assetsFromScanEntries)
 *                     → AssetService.ingest → AssetRepository → Supabase
 *
 * PROFILE assets are IGNORED here (they belong to the officer-extraction
 * pipeline); the AssetService also enforces this, so profile data can never
 * leak into the Gallery table. Idempotent: assets upsert by `assetId`, so
 * re-importing the same discovery creates no duplicates.
 *
 * Dependency-injected (the AssetService, and therefore its repository, are
 * supplied) — no singleton, no globals. No OCR, no OpenAI, no officer tables.
 */

import type { DriveScanEntry } from "@/lib/google-drive/drive_scan_report";
import { assetsFromScanEntries } from "@/lib/gallery/asset_builder";
import { AssetCategory, isReservedCategory } from "@/lib/gallery/asset_category";
import type { AssetService } from "@/lib/gallery/asset_service";

/** Summary of a Gallery import run. */
export interface GalleryImportSummary {
  discovered: number;
  images: number;
  profile_ignored: number;
  assets_created: number;
  assets_updated: number;
  elapsed_ms: number;
  /** Per Gallery category, how many assets were ingested (created + updated). */
  by_category: Record<string, number>;
}

export interface GalleryImporterDependencies {
  service: AssetService;
}

export class GalleryImporter {
  private readonly service: AssetService;

  constructor(dependencies: GalleryImporterDependencies) {
    this.service = dependencies.service;
  }

  /**
   * Imports the non-profile image assets from a batch of discovered entries.
   * Builds assets (image files only), drops PROFILE, and idempotently ingests
   * the rest via the injected service. Returns a summary.
   */
  async import(entries: DriveScanEntry[]): Promise<GalleryImportSummary> {
    const startedAt = Date.now();

    // Build assets from IMAGE entries (assetsFromScanEntries already drops
    // non-image files); then exclude the reserved PROFILE category.
    const allAssets = assetsFromScanEntries(entries);
    const galleryAssets = allAssets.filter((a) => !isReservedCategory(a.category));
    const profileIgnored = allAssets.length - galleryAssets.length;

    const byCategory: Record<string, number> = {};
    for (const asset of galleryAssets) {
      byCategory[asset.category] = (byCategory[asset.category] ?? 0) + 1;
    }

    const result = await this.service.ingest(galleryAssets);

    return {
      discovered: entries.length,
      images: allAssets.length,
      profile_ignored: profileIgnored,
      assets_created: result.created,
      assets_updated: result.updated,
      elapsed_ms: Date.now() - startedAt,
      by_category: byCategory,
    };
  }
}

/** Categories the importer will persist (everything the Gallery serves — i.e. not PROFILE). */
export const IMPORTABLE_ASSET_CATEGORIES: readonly AssetCategory[] = [
  AssetCategory.NeighborMap,
  AssetCategory.OrgChart,
  AssetCategory.DeploymentMap,
  AssetCategory.CompanyLocation,
  AssetCategory.BattalionLocation,
  AssetCategory.Unknown,
];
