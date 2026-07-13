/**
 * Document upload dependency container (Phase 29A / 29B.1).
 *
 * Two exported factory functions with different requirements:
 *
 *   getDocumentContainer()
 *     Requires Supabase Storage to be configured (SUPABASE_SERVICE_ROLE_KEY
 *     + NEXT_PUBLIC_SUPABASE_URL). Used by upload and download — the same
 *     resolved configuration is shared. Returns { configured:false } when
 *     the storage env vars are absent so the API answers 503 with an
 *     actionable message instead of crashing.
 *     NOTE: does NOT check bucket existence at init time. Bucket errors
 *     surface naturally when storage.put() is called during an upload.
 *
 *   getDocumentReadContainer()
 *     DB-only. Never touches storage. No env validation. Always succeeds as
 *     long as the database is reachable. Used by history and other read-only
 *     endpoints so they work even when Supabase Storage is not configured.
 */

import { DocumentUploadService } from "@/lib/document/document_upload_service";
import type { PortraitStorage } from "@/lib/portrait/portrait_storage";
import { SupabasePortraitStorage, resolveSupabaseStorageConfig } from "@/lib/portrait/portrait_storage";
import { DocumentRepository } from "@/lib/database/repositories/document_repository";
import type { DatabaseClient } from "@/lib/database/database_types";
import { DOCUMENT_BUCKET_DEFAULT } from "@/lib/storage/storage_config";
import { validateStorageEnvironment } from "@/lib/storage/storage_diagnostics";

export interface DocumentContainer {
  service: DocumentUploadService;
  repository: DocumentRepository;
}

/** Builds the container from any repository + storage (real or fake). Pure — no I/O. */
export function createDocumentContainer(deps: {
  db: DatabaseClient;
  storage: PortraitStorage;
}): DocumentContainer {
  const repository = new DocumentRepository(deps.db);
  const service = new DocumentUploadService({ repository, storage: deps.storage });
  return { service, repository };
}

export type GetDocumentContainerResult =
  | { configured: true; container: DocumentContainer }
  | { configured: false; reason: string };

let cachedContainer: DocumentContainer | undefined;

/**
 * Lazily builds the production container for operations that need storage
 * (upload, download). Returns configured:false with an actionable reason
 * when SUPABASE_SERVICE_ROLE_KEY or the Supabase URL is absent.
 *
 * Does NOT check bucket existence at init time — bucket errors surface
 * naturally from SupabasePortraitStorage.put() during an actual upload,
 * which already emits a human-readable "bucket 'X' does not exist" message.
 * Removing the pre-flight bucket check ensures that download (which never
 * writes to storage) is not blocked by a missing or misspelled bucket name.
 */
export async function getDocumentContainer(): Promise<GetDocumentContainerResult> {
  if (cachedContainer) {
    return { configured: true, container: cachedContainer };
  }

  const baseConfig = resolveSupabaseStorageConfig();
  if (!baseConfig) {
    const { reason } = validateStorageEnvironment();
    return { configured: false, reason };
  }

  const bucket = process.env.SUPABASE_DOCUMENT_BUCKET?.trim() || DOCUMENT_BUCKET_DEFAULT;
  const config = { ...baseConfig, bucket };

  const { createDatabaseClient } = await import("@/lib/database/database");
  const db = createDatabaseClient() as unknown as DatabaseClient;
  const storage = new SupabasePortraitStorage(config);

  cachedContainer = createDocumentContainer({ db, storage });
  return { configured: true, container: cachedContainer };
}

/**
 * Builds a DB-only container for read-only operations (history, list, etc.)
 * that never write to storage. No env validation, no bucket check, no
 * storage initialisation. Works even when Supabase Storage is completely
 * unavailable or unconfigured.
 *
 * The injected storage is a no-op stub — it will throw if upload() is ever
 * accidentally called through this container, making the misuse obvious.
 */
export async function getDocumentReadContainer(): Promise<DocumentContainer> {
  const { createDatabaseClient } = await import("@/lib/database/database");
  const db = createDatabaseClient() as unknown as DatabaseClient;

  const noOpStorage: PortraitStorage = {
    put: async () => {
      throw new Error(
        "getDocumentReadContainer() is for read-only operations — use getDocumentContainer() for uploads."
      );
    },
    remove: async () => undefined,
  };

  return createDocumentContainer({ db, storage: noOpStorage });
}
