/**
 * Document container (Phase 29A / 29B / 29B.3).
 *
 * Two exported factory functions:
 *
 *   getDocumentContainer()
 *     Always returns a DocumentContainer — never fails. When Supabase
 *     Storage is configured (SUPABASE_SERVICE_ROLE_KEY present) the real
 *     SupabasePortraitStorage is injected and the container is cached for
 *     the process lifetime. When Storage is NOT configured a no-op stub is
 *     injected instead so that DB-only operations (delete, download,
 *     history, list) work normally; the stub throws a clear message only
 *     if upload() actually tries to write bytes, surfacing the missing-key
 *     error exactly where it is relevant instead of blocking every route.
 *
 *     Removing the old "return { configured:false }" path eliminates the
 *     duplicated `if (!result.configured) return serviceUnavailable(...)`
 *     guard that was copy-pasted across four route files and caused Delete /
 *     Download / Get to return 503 even though those operations never touch
 *     Storage.
 *
 *   getDocumentReadContainer()
 *     DB-only. Used by the history route. No storage injection at all,
 *     no env validation, always available.
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

let cachedContainer: DocumentContainer | undefined;

/**
 * Returns a DocumentContainer unconditionally. Never throws, never returns
 * a "not configured" value — there is no failure path at the container level.
 *
 * Storage configuration:
 *   - SUPABASE_SERVICE_ROLE_KEY present → real SupabasePortraitStorage,
 *     container is cached for the process lifetime.
 *   - SUPABASE_SERVICE_ROLE_KEY absent  → no-op storage stub injected,
 *     container NOT cached (so the key can take effect without restart).
 *     The stub throws a readable "key not set" message only when
 *     storage.put() is called (i.e. only during an actual upload).
 *
 * All routes — upload, replace, delete, download, get — call this one
 * function. There is no duplicated storage-availability check at the route
 * layer.
 */
export async function getDocumentContainer(): Promise<DocumentContainer> {
  if (cachedContainer) return cachedContainer;

  const { createDatabaseClient } = await import("@/lib/database/database");
  const db = createDatabaseClient() as unknown as DatabaseClient;

  const baseConfig = resolveSupabaseStorageConfig();

  if (baseConfig) {
    const bucket = process.env.SUPABASE_DOCUMENT_BUCKET?.trim() || DOCUMENT_BUCKET_DEFAULT;
    const storage = new SupabasePortraitStorage({ ...baseConfig, bucket });
    cachedContainer = createDocumentContainer({ db, storage });
    return cachedContainer;
  }

  // Storage not configured — inject a stub that fails loudly only when bytes
  // are actually being written. Do NOT cache so the container is rebuilt once
  // the key is added and the request is retried (no server restart needed).
  const { reason } = validateStorageEnvironment();
  const noConfigStorage: PortraitStorage = {
    put: async () => {
      throw new Error(reason);
    },
    remove: async () => undefined,
  };
  return createDocumentContainer({ db, storage: noConfigStorage });
}

/**
 * DB-only container for the history endpoint. No storage at all — no env
 * validation, no stub, nothing. Guaranteed to work even if Supabase Storage
 * is completely absent.
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
