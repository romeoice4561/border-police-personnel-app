/**
 * Organization dependency container (Phase 20A).
 *
 * Assembles the Organization persistence graph — PrismaOrganizationRepository
 * -> OrganizationService — over an injected OrganizationDbClient. Mirrors the
 * Gallery container's DI seam:
 *   - `createOrganizationContainer(client)` builds the graph from any
 *     OrganizationDbClient (the real Prisma client in production, a fake in
 *     tests), and
 *   - `getOrganizationContainer()` lazily creates the production graph backed
 *     by the real Supabase-connected Prisma client, reused per process — not
 *     a global singleton of shared mutable state.
 *
 * No OCR, no AI, no officer tables, no globals leaked.
 */

import type { OrganizationDbClient } from "@/lib/organization/prisma_organization_repository";
import { PrismaOrganizationRepository } from "@/lib/organization/prisma_organization_repository";
import { OrganizationService } from "@/lib/organization/organization_service";
import type { OrganizationRepository } from "@/lib/organization/organization_repository";

export interface OrganizationContainer {
  repository: OrganizationRepository;
  service: OrganizationService;
}

/** Builds the Organization graph from any OrganizationDbClient (real or fake). Pure — no I/O. */
export function createOrganizationContainer(client: OrganizationDbClient): OrganizationContainer {
  const repository = new PrismaOrganizationRepository(client);
  const service = new OrganizationService({ repository });
  return { repository, service };
}

let cachedClient: OrganizationDbClient | undefined;

/**
 * Lazily builds (once per process) the production Organization container
 * backed by the real Prisma client. Imported dynamically so this module never
 * pulls the Prisma runtime unless a real request needs it.
 */
export async function getOrganizationContainer(): Promise<OrganizationContainer> {
  if (!cachedClient) {
    const { createDatabaseClient } = await import("@/lib/database/database");
    cachedClient = createDatabaseClient() as unknown as OrganizationDbClient;
  }
  return createOrganizationContainer(cachedClient);
}
