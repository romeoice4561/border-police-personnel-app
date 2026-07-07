/**
 * AssetService (Phase 19A — Gallery Foundation).
 *
 * The Gallery's application layer: it depends on an injected AssetRepository
 * (constructor injection — no singleton, no global), enforces the Gallery
 * policy (the reserved PROFILE category is never served — profiles belong to
 * the officer pipeline), and exposes the read operations the future Asset API
 * and Gallery UI consume: list-with-filters, get-by-id, and the category /
 * region / company facet counts that drive the "Filter by Category → Region →
 * Company" flow.
 *
 * It also offers an idempotent ingest entry point (assets built from discovery)
 * so a later phase can populate the store — WITHOUT any OCR/officer/DB coupling
 * here (the repository decides how it persists).
 *
 * No OCR, no AI, no officer tables, no globals.
 */

import type { AssetRepository } from "@/lib/gallery/asset_repository";
import type {
  Asset,
  AssetCategoryCount,
  AssetFacetCount,
  AssetMetadataPatch,
  AssetQuery,
  PaginatedAssets,
} from "@/lib/gallery/asset_types";
import { AssetCategory, isReservedCategory } from "@/lib/gallery/asset_category";

export interface AssetServiceDependencies {
  repository: AssetRepository;
}

/** Result of ingesting a batch of assets (idempotent — reruns create no duplicates). */
export interface AssetIngestResult {
  created: number;
  updated: number;
  skippedReserved: number;
}

export class AssetService {
  private readonly repository: AssetRepository;

  constructor(dependencies: AssetServiceDependencies) {
    this.repository = dependencies.repository;
  }

  /**
   * Lists Gallery assets. A request for the reserved PROFILE category returns
   * an empty page (profiles are not Gallery assets); otherwise it delegates to
   * the repository with the caller's filters/sort/paging.
   */
  async list(query: AssetQuery): Promise<PaginatedAssets> {
    if (query.category !== undefined && isReservedCategory(query.category)) {
      return { data: [], total: 0, page: query.page ?? 1, pageSize: query.pageSize ?? 0, totalPages: 0 };
    }
    return this.repository.list(query);
  }

  /** Fetches one asset by id — but never a reserved (PROFILE) asset via the Gallery. */
  async getById(assetId: string): Promise<Asset | null> {
    const asset = await this.repository.findById(assetId);
    if (!asset || isReservedCategory(asset.category)) return null;
    return asset;
  }

  /** Gallery category facets (reserved PROFILE already excluded by the repository). */
  categoryCounts(): Promise<AssetCategoryCount[]> {
    return this.repository.categoryCounts();
  }

  /** Region facets, optionally scoped to a category (drives the Region filter). */
  regionCounts(category?: AssetCategory): Promise<AssetFacetCount[]> {
    if (category !== undefined && isReservedCategory(category)) return Promise.resolve([]);
    return this.repository.regionCounts(category);
  }

  /** Company facets, optionally scoped to category/region (drives the Company filter). */
  companyCounts(filter?: { category?: AssetCategory; region?: string }): Promise<AssetFacetCount[]> {
    if (filter?.category !== undefined && isReservedCategory(filter.category)) return Promise.resolve([]);
    return this.repository.companyCounts(filter);
  }

  /**
   * Phase 22A: updates only the supplied editable metadata fields for a Gallery
   * asset. Reserved (PROFILE) assets are never updated. Returns the updated
   * asset, or null when the id is not found or belongs to a reserved category.
   */
  async updateMetadata(assetId: string, patch: AssetMetadataPatch): Promise<Asset | null> {
    const existing = await this.repository.findById(assetId);
    if (!existing || isReservedCategory(existing.category)) return null;
    return this.repository.updateMetadata(assetId, patch);
  }

  /**
   * Idempotently ingests assets built from discovery. Reserved (PROFILE) assets
   * are skipped — they are not Gallery content. Returns created/updated tallies.
   * (A later phase wires a discovery→ingest runner; nothing is imported here.)
   */
  async ingest(assets: Asset[]): Promise<AssetIngestResult> {
    let created = 0;
    let updated = 0;
    let skippedReserved = 0;

    for (const asset of assets) {
      if (isReservedCategory(asset.category)) {
        skippedReserved += 1;
        continue;
      }
      const { created: wasCreated } = await this.repository.upsert(asset);
      if (wasCreated) created += 1;
      else updated += 1;
    }

    return { created, updated, skippedReserved };
  }
}
