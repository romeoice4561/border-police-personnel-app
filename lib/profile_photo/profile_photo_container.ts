/**
 * ProfilePhoto dependency container (Phase 21C — Universal Profile Photo Inbox).
 *
 * Assembles the ProfilePhoto persistence graph — PrismaProfilePhotoRepository
 * -> ProfilePhotoService -> ProfilePhotoImporter — over an injected
 * ProfilePhotoDbClient. Mirrors the Gallery container's DI seam exactly:
 *   - `createProfilePhotoContainer(client)` builds the graph from any client
 *     (the real Prisma client in production, a fake in tests), and
 *   - `getProfilePhotoContainer()` lazily creates the production graph backed
 *     by the real Supabase-connected Prisma client, reused per process — not
 *     a global singleton of shared mutable state.
 *
 * No OCR, no AI, no Officer table writes, no globals leaked.
 */

import type { ProfilePhotoDbClient } from "@/lib/profile_photo/prisma_profile_photo_repository";
import { PrismaProfilePhotoRepository } from "@/lib/profile_photo/prisma_profile_photo_repository";
import { ProfilePhotoService } from "@/lib/profile_photo/profile_photo_service";
import { ProfilePhotoImporter } from "@/lib/profile_photo/profile_photo_importer";
import type { ProfilePhotoRepository } from "@/lib/profile_photo/profile_photo_repository";

export interface ProfilePhotoContainer {
  repository: ProfilePhotoRepository;
  service: ProfilePhotoService;
  importer: ProfilePhotoImporter;
}

/** Builds the ProfilePhoto graph from any ProfilePhotoDbClient (real or fake). Pure — no I/O. */
export function createProfilePhotoContainer(client: ProfilePhotoDbClient): ProfilePhotoContainer {
  const repository = new PrismaProfilePhotoRepository(client);
  const service = new ProfilePhotoService({ repository });
  const importer = new ProfilePhotoImporter({ service });
  return { repository, service, importer };
}

let cachedClient: ProfilePhotoDbClient | undefined;

/**
 * Lazily builds (once per process) the production ProfilePhoto container
 * backed by the real Prisma client. Imported dynamically so this module never
 * pulls the Prisma runtime unless a real request needs it.
 */
export async function getProfilePhotoContainer(): Promise<ProfilePhotoContainer> {
  if (!cachedClient) {
    const { createDatabaseClient } = await import("@/lib/database/database");
    cachedClient = createDatabaseClient() as unknown as ProfilePhotoDbClient;
  }
  return createProfilePhotoContainer(cachedClient);
}
