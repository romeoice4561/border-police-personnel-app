/**
 * GalleryImporter (Phase 19B — Gallery Persistence; Phase 20B — Organization linking).
 *
 * Consumes Drive DISCOVERY entries (DriveScanEntry) and persists the non-profile
 * ones as Gallery assets:
 *
 *   DriveScanEntry[]  → (ignore PROFILE + non-images)
 *                     → AssetBuilder (assetsFromScanEntries)
 *                     → [optional] resolve `company` text → companyId via
 *                       OrganizationService (Phase 20A master data)
 *                     → AssetService.ingest → AssetRepository → Supabase
 *
 * PROFILE assets are IGNORED here (they belong to the officer-extraction
 * pipeline); the AssetService also enforces this, so profile data can never
 * leak into the Gallery table. Idempotent: assets upsert by `assetId`, so
 * re-importing the same discovery creates no duplicates.
 *
 * Organization linking is OPTIONAL and additive: when an OrganizationService
 * is injected, each asset's existing `company` text is resolved against the
 * Phase 20A master data and — only when it resolves to a registered Company —
 * `companyId` is attached. An unresolved code is left as `companyId: null`
 * (recorded for review by the service itself) and the asset's `company`/
 * `battalion`/`region` text fields are NEVER altered. Omitting the dependency
 * reproduces Phase 19B behavior exactly (no organization dependency, no
 * companyId set) — fully backward compatible.
 *
 * Dependency-injected — no singleton, no globals. No OCR, no OpenAI, no
 * officer tables.
 */

import type { DriveScanEntry } from "@/lib/google-drive/drive_scan_report";
import { assetsFromScanEntries } from "@/lib/gallery/asset_builder";
import { AssetCategory, isReservedCategory } from "@/lib/gallery/asset_category";
import type { AssetService } from "@/lib/gallery/asset_service";
import type { Asset } from "@/lib/gallery/asset_types";
import type { OrganizationService } from "@/lib/organization/organization_service";

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
  /** Phase 20B: how many ingested assets resolved to a registered Company (0 if no OrganizationService was injected). */
  organization_linked: number;
}

export interface GalleryImporterDependencies {
  service: AssetService;
  /** Phase 20B: optional — when supplied, resolves each asset's `company` text to a master-data Company id. */
  organizationService?: OrganizationService;
}

const ORGANIZATION_SOURCE_MODULE = "gallery_importer";

export class GalleryImporter {
  private readonly service: AssetService;
  private readonly organizationService: OrganizationService | undefined;

  constructor(dependencies: GalleryImporterDependencies) {
    this.service = dependencies.service;
    this.organizationService = dependencies.organizationService;
  }

  /**
   * Resolves `asset.company` (if present) against the Organization master
   * data and returns the asset with `companyId` attached when it resolves to
   * a registered Company. Never touches the existing text fields. Returns the
   * asset unchanged if no OrganizationService was injected, `company` is
   * absent, or the code does not resolve (the service already records
   * unresolved codes for review).
   */
  private async withCompanyLink(asset: Asset): Promise<Asset> {
    if (!this.organizationService || !asset.company) return asset;
    const resolution = await this.organizationService.resolveCode(asset.company, ORGANIZATION_SOURCE_MODULE);
    if (resolution.status === "resolved" && resolution.level === "company") {
      return { ...asset, companyId: resolution.company.id };
    }
    return asset;
  }

  /**
   * Imports the non-profile image assets from a batch of discovered entries.
   * Builds assets (image files only), drops PROFILE, optionally resolves each
   * asset's organization placement, and idempotently ingests the rest via the
   * injected service. Returns a summary.
   */
  async import(entries: DriveScanEntry[]): Promise<GalleryImportSummary> {
    const startedAt = Date.now();

    // Build assets from IMAGE entries (assetsFromScanEntries already drops
    // non-image files); then exclude the reserved PROFILE category.
    const allAssets = assetsFromScanEntries(entries);
    const galleryAssets = allAssets.filter((a) => !isReservedCategory(a.category));
    const profileIgnored = allAssets.length - galleryAssets.length;

    const linkedAssets = await Promise.all(galleryAssets.map((asset) => this.withCompanyLink(asset)));
    const organizationLinked = linkedAssets.filter((a) => a.companyId != null).length;

    const byCategory: Record<string, number> = {};
    for (const asset of linkedAssets) {
      byCategory[asset.category] = (byCategory[asset.category] ?? 0) + 1;
    }

    const result = await this.service.ingest(linkedAssets);

    return {
      discovered: entries.length,
      images: allAssets.length,
      profile_ignored: profileIgnored,
      assets_created: result.created,
      assets_updated: result.updated,
      elapsed_ms: Date.now() - startedAt,
      by_category: byCategory,
      organization_linked: organizationLinked,
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
