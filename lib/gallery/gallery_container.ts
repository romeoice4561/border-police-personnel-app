/**
 * Gallery dependency container (Phase 19B).
 *
 * Assembles the Gallery persistence graph — PrismaAssetRepository → AssetService
 * → GalleryImporter — over an injected AssetDbClient. This is the single DI seam:
 *   - `createGalleryContainer(client)` builds the graph from any AssetDbClient
 *     (the real Prisma client in production, a fake in tests), and
 *   - `getGalleryContainer()` lazily creates the production graph backed by the
 *     real Supabase-connected Prisma client (Phase 12 database factory), reused
 *     per process — not a global singleton of shared mutable state.
 *
 * No OCR, no AI, no officer tables, no globals leaked.
 */

import type { AssetDbClient } from "@/lib/gallery/prisma_asset_repository";
import { PrismaAssetRepository } from "@/lib/gallery/prisma_asset_repository";
import { AssetService } from "@/lib/gallery/asset_service";
import { GalleryImporter } from "@/lib/gallery/gallery_importer";
import type { AssetRepository } from "@/lib/gallery/asset_repository";

export interface GalleryContainer {
  repository: AssetRepository;
  service: AssetService;
  importer: GalleryImporter;
}

/** Builds the Gallery graph from any AssetDbClient (real or fake). Pure — no I/O. */
export function createGalleryContainer(client: AssetDbClient): GalleryContainer {
  const repository = new PrismaAssetRepository(client);
  const service = new AssetService({ repository });
  const importer = new GalleryImporter({ service });
  return { repository, service, importer };
}

let cachedClient: AssetDbClient | undefined;

/**
 * Lazily builds (once per process) the production Gallery container backed by
 * the real Prisma client. Imported dynamically so this module — and the Gallery
 * repository/service — never pull the Prisma runtime unless a real request needs it.
 */
export async function getGalleryContainer(): Promise<GalleryContainer> {
  if (!cachedClient) {
    const { createDatabaseClient } = await import("@/lib/database/database");
    cachedClient = createDatabaseClient() as unknown as AssetDbClient;
  }
  return createGalleryContainer(cachedClient);
}
