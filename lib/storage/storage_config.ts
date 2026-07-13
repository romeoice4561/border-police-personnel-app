/**
 * Shared Supabase Storage bucket configuration (Phase 29A.1 — Storage Repair).
 *
 * Single source of truth for bucket names. Always override with the
 * corresponding env var in production; these are the defaults used when the
 * env var is absent.
 *
 * Bucket layout:
 *   officer-portraits  — officer portrait photos    (PortraitUploadService)
 *   officer-documents  — officer official documents (DocumentUploadService)
 *
 * If your Supabase project uses different names, override via:
 *   SUPABASE_PORTRAIT_BUCKET=<name>
 *   SUPABASE_DOCUMENT_BUCKET=<name>
 */

/** Default Supabase Storage bucket for officer portrait photos. */
export const PORTRAIT_BUCKET_DEFAULT = "officer-portraits";

/** Default Supabase Storage bucket for officer official documents. */
export const DOCUMENT_BUCKET_DEFAULT = "officer-documents";
