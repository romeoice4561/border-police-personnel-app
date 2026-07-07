/**
 * Gallery dependency container (Phase 19B; Phase 20B adds Organization linking).
 *
 * Assembles the Gallery persistence graph — PrismaAssetRepository → AssetService
 * → GalleryImporter — over an injected AssetDbClient. This is the single DI seam:
 *   - `createGalleryContainer(client)` builds the graph from any AssetDbClient
 *     (the real Prisma client in production, a fake in tests), and
 *   - `getGalleryContainer()` lazily creates the production graph backed by the
 *     real Supabase-connected Prisma client (Phase 12 database factory), reused
 *     per process — not a global singleton of shared mutable state.
 *
 * Phase 20B: the same client also backs an OrganizationRepository/Service
 * (Phase 20A), injected into GalleryImporter so future imports resolve each
 * asset's `company` text to the master-data Company id — additive, optional,
 * and never required to build the container.
 *
 * No OCR, no AI, no officer tables, no globals leaked.
 */

import type { AssetDbClient } from "@/lib/gallery/prisma_asset_repository";
import { PrismaAssetRepository } from "@/lib/gallery/prisma_asset_repository";
import { AssetService } from "@/lib/gallery/asset_service";
import { GalleryImporter } from "@/lib/gallery/gallery_importer";
import type { AssetRepository } from "@/lib/gallery/asset_repository";
import type { OrganizationDbClient } from "@/lib/organization/prisma_organization_repository";
import { PrismaOrganizationRepository } from "@/lib/organization/prisma_organization_repository";
import { OrganizationService } from "@/lib/organization/organization_service";

export interface GalleryContainer {
  repository: AssetRepository;
  service: AssetService;
  importer: GalleryImporter;
  organizationService: OrganizationService;
}

/** A client satisfying both the Gallery and Organization delegate surfaces. */
export type GalleryDbClient = AssetDbClient & OrganizationDbClient;

/** Builds the Gallery graph from any GalleryDbClient (real or fake). Pure — no I/O. */
export function createGalleryContainer(client: GalleryDbClient): GalleryContainer {
  const repository = new PrismaAssetRepository(client);
  const service = new AssetService({ repository });
  const organizationRepository = new PrismaOrganizationRepository(client);
  const organizationService = new OrganizationService({ repository: organizationRepository });
  const importer = new GalleryImporter({ service, organizationService });
  return { repository, service, importer, organizationService };
}

let cachedClient: GalleryDbClient | undefined;

/**
 * Lazily builds (once per process) the production Gallery container backed by
 * the real Prisma client. Imported dynamically so this module — and the Gallery
 * repository/service — never pull the Prisma runtime unless a real request needs it.
 */
export async function getGalleryContainer(): Promise<GalleryContainer> {
  if (!cachedClient) {
    const { createDatabaseClient } = await import("@/lib/database/database");
    cachedClient = createDatabaseClient() as unknown as GalleryDbClient;
  }
  return createGalleryContainer(cachedClient);
}
