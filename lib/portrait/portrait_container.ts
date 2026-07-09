/**
 * Portrait upload dependency container (Phase 24B-1).
 *
 * Assembles PortraitUploadService over the real Prisma client + Supabase
 * Storage, mirroring the officer_profile / gallery containers' DI seam:
 *   - createPortraitContainer(deps) builds the graph from any client + storage
 *     (fakes in tests).
 *   - getPortraitContainer() lazily builds the production graph, reused per
 *     process. Returns { configured:false } when Supabase Storage is not set up
 *     (feature-var pattern) so the API can answer with a clear 503 instead of
 *     crashing — Drive stays read-only regardless.
 */

import type { PortraitPhotoClient } from "@/lib/portrait/portrait_upload_service";
import { PortraitUploadService } from "@/lib/portrait/portrait_upload_service";
import type { PortraitStorage } from "@/lib/portrait/portrait_storage";
import { SupabasePortraitStorage, resolveSupabaseStorageConfig } from "@/lib/portrait/portrait_storage";

export interface PortraitContainer {
  service: PortraitUploadService;
}

/** Builds the container from any client + storage (real or fake). Pure — no I/O. */
export function createPortraitContainer(deps: {
  db: PortraitPhotoClient;
  storage: PortraitStorage;
}): PortraitContainer {
  return { service: new PortraitUploadService({ db: deps.db, storage: deps.storage }) };
}

export type GetPortraitContainerResult =
  | { configured: true; container: PortraitContainer }
  | { configured: false; reason: string };

let cachedClient: PortraitPhotoClient | undefined;

/**
 * Lazily builds the production container. Returns configured:false with a
 * readable reason when SUPABASE_SERVICE_ROLE_KEY / project URL are absent —
 * the upload endpoint maps that to 503 with an actionable message.
 */
export async function getPortraitContainer(): Promise<GetPortraitContainerResult> {
  const config = resolveSupabaseStorageConfig();
  if (!config) {
    return {
      configured: false,
      reason:
        "Portrait storage is not configured. Set SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) " +
        "and create the Supabase Storage bucket to enable portrait uploads.",
    };
  }

  if (!cachedClient) {
    const { createDatabaseClient } = await import("@/lib/database/database");
    cachedClient = createDatabaseClient() as unknown as PortraitPhotoClient;
  }

  const storage = new SupabasePortraitStorage(config);
  return { configured: true, container: createPortraitContainer({ db: cachedClient, storage }) };
}
