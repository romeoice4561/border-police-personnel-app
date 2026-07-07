/**
 * AssetRepository (Phase 19A — Gallery Foundation).
 *
 * The persistence CONTRACT for Gallery assets, plus an in-memory reference
 * implementation. The interface is what the Asset service depends on (via
 * constructor injection), so a future database-backed repository (deferred —
 * NO migration in this phase) is a drop-in replacement. The in-memory impl lets
 * the service + API be built and tested now without a DB.
 *
 * Read/query + idempotent upsert (keyed on assetId). No OCR, no AI, no officer
 * tables, no globals, no singleton.
 */

import type { Asset, AssetQuery, PaginatedAssets, AssetCategoryCount, AssetFacetCount } from "@/lib/gallery/asset_types";
import { AssetCategory, isGalleryCategory } from "@/lib/gallery/asset_category";

/** Read/write contract every Asset repository implements. */
export interface AssetRepository {
  /** Idempotent upsert keyed on assetId. Returns whether the asset was newly created. */
  upsert(asset: Asset): Promise<{ asset: Asset; created: boolean }>;
  /** Fetches one asset by id, or null. */
  findById(assetId: string): Promise<Asset | null>;
  /** Lists assets matching the query (filtered, sorted, paginated). */
  list(query: AssetQuery): Promise<PaginatedAssets>;
  /** Distinct Gallery categories present, with counts. */
  categoryCounts(): Promise<AssetCategoryCount[]>;
  /** Distinct regions present (optionally within a category), with counts. */
  regionCounts(category?: AssetCategory): Promise<AssetFacetCount[]>;
  /** Distinct companies present (optionally within a category/region), with counts. */
  companyCounts(filter?: { category?: AssetCategory; region?: string }): Promise<AssetFacetCount[]>;
  /** Total asset count. */
  count(): Promise<number>;
}

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function textMatches(haystack: string | null | undefined, needle: string, mode: AssetQuery["match"]): boolean {
  const h = norm(haystack);
  const n = norm(needle);
  if (n.length === 0) return true;
  if (mode === "exact") return h === n;
  if (mode === "startsWith") return h.startsWith(n);
  return h.includes(n);
}

/**
 * In-memory reference AssetRepository — the deferred-DB stand-in. Deterministic
 * and dependency-free; the future Prisma-backed repo implements the same
 * interface. Constructor-injectable seed for tests.
 */
export class InMemoryAssetRepository implements AssetRepository {
  private readonly assets = new Map<string, Asset>();

  constructor(seed: Asset[] = []) {
    for (const a of seed) this.assets.set(a.assetId, a);
  }

  async upsert(asset: Asset): Promise<{ asset: Asset; created: boolean }> {
    const created = !this.assets.has(asset.assetId);
    this.assets.set(asset.assetId, asset);
    return { asset, created };
  }

  async findById(assetId: string): Promise<Asset | null> {
    return this.assets.get(assetId) ?? null;
  }

  private matching(query: AssetQuery): Asset[] {
    const match = query.match ?? "contains";
    return Array.from(this.assets.values()).filter((a) => {
      // Reserved PROFILE assets are never Gallery content — excluded from every
      // list, matching the Prisma repository's DB-level exclusion so both
      // implementations honor the same contract.
      if (!isGalleryCategory(a.category)) return false;
      if (query.category !== undefined && a.category !== query.category) return false;
      if (query.region && !textMatches(a.region, query.region, "exact")) return false;
      if (query.company && !textMatches(a.company, query.company, "exact")) return false;
      if (query.battalion && !textMatches(a.battalion, query.battalion, "exact")) return false;
      if (query.companyId !== undefined && (a.companyId ?? null) !== query.companyId) return false;
      if (query.search) {
        const inFolder = textMatches(a.folderName, query.search, match);
        const inPath = textMatches(a.relativePath, query.search, match);
        if (!inFolder && !inPath) return false;
      }
      return true;
    });
  }

  async list(query: AssetQuery): Promise<PaginatedAssets> {
    const filtered = this.matching(query);

    const sortBy = query.sortBy ?? "folderName";
    const dir = query.sortOrder === "asc" ? 1 : -1;
    filtered.sort((a, b) => {
      const av = (a[sortBy] ?? "") as string;
      const bv = (b[sortBy] ?? "") as string;
      if (av === bv) return a.assetId.localeCompare(b.assetId);
      return av > bv ? dir : -dir;
    });

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
    const start = (page - 1) * pageSize;

    return {
      data: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
      totalPages: pageSize > 0 ? Math.ceil(filtered.length / pageSize) : 0,
    };
  }

  async categoryCounts(): Promise<AssetCategoryCount[]> {
    const counts = new Map<AssetCategory, number>();
    for (const a of this.assets.values()) {
      if (!isGalleryCategory(a.category)) continue; // PROFILE is reserved, not a Gallery category
      counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((x, y) => y.count - x.count);
  }

  async regionCounts(category?: AssetCategory): Promise<AssetFacetCount[]> {
    return this.facetCounts((a) => a.region, (a) => category === undefined || a.category === category);
  }

  async companyCounts(filter?: { category?: AssetCategory; region?: string }): Promise<AssetFacetCount[]> {
    return this.facetCounts(
      (a) => a.company,
      (a) =>
        (filter?.category === undefined || a.category === filter.category) &&
        (filter?.region === undefined || a.region === filter.region)
    );
  }

  private facetCounts(pick: (a: Asset) => string | null, keep: (a: Asset) => boolean): AssetFacetCount[] {
    const counts = new Map<string, number>();
    for (const a of this.assets.values()) {
      if (!isGalleryCategory(a.category) || !keep(a)) continue;
      const value = pick(a);
      if (!value) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((x, y) => y.count - x.count || x.value.localeCompare(y.value));
  }

  async count(): Promise<number> {
    return this.assets.size;
  }
}
