/**
 * Document upload dependency container (Phase 29A — Officer Document Vault Foundation).
 *
 * Assembles DocumentUploadService over the real Prisma client + Supabase
 * Storage. Mirrors portrait_container.ts's DI seam:
 *   - createDocumentContainer(deps) builds the graph from any repo + storage
 *     (fakes in tests).
 *   - getDocumentContainer() lazily builds the production graph, reused per
 *     process. Returns { configured:false } when Supabase Storage is not set
 *     up (feature-var pattern) so the API answers with a clear 503 instead
 *     of crashing.
 *
 * Reuses SupabasePortraitStorage and resolveSupabaseStorageConfig from the
 * portrait module — documents go to a SEPARATE bucket
 * (SUPABASE_DOCUMENT_BUCKET, default "documents") so portrait and document
 * bytes never share the same namespace.
 */

import { DocumentUploadService } from "@/lib/document/document_upload_service";
import type { PortraitStorage } from "@/lib/portrait/portrait_storage";
import { SupabasePortraitStorage, resolveSupabaseStorageConfig } from "@/lib/portrait/portrait_storage";
import { DocumentRepository } from "@/lib/database/repositories/document_repository";
import type { DatabaseClient } from "@/lib/database/database_types";

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
 * Lazily builds the production container. Returns configured:false with a
 * readable reason when Supabase Storage variables are absent — the upload
 * endpoint maps that to 503 with an actionable message.
 *
 * The document bucket is SUPABASE_DOCUMENT_BUCKET (default "documents"),
 * separate from the portrait bucket (SUPABASE_PORTRAIT_BUCKET / "portraits").
 */
export async function getDocumentContainer(): Promise<GetDocumentContainerResult> {
  if (cachedContainer) {
    return { configured: true, container: cachedContainer };
  }

  const baseConfig = resolveSupabaseStorageConfig();
  if (!baseConfig) {
    return {
      configured: false,
      reason:
        "Document storage is not configured. Set SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) " +
        "and create the Supabase Storage bucket to enable document uploads.",
    };
  }

  const bucket = process.env.SUPABASE_DOCUMENT_BUCKET?.trim() || "documents";
  const config = { ...baseConfig, bucket };

  const { createDatabaseClient } = await import("@/lib/database/database");
  const db = createDatabaseClient() as unknown as DatabaseClient;
  const storage = new SupabasePortraitStorage(config);

  cachedContainer = createDocumentContainer({ db, storage });
  return { configured: true, container: cachedContainer };
}
