/**
 * Officer Document API handlers (Phase 29A — Officer Document Vault Foundation).
 *
 * Framework-agnostic core of the document endpoints. Each handler takes a
 * DocumentUploadService + already-resolved params (or a raw Request) and
 * returns a Web Response using the shared { data } / { error } envelope,
 * so they are unit-testable with a fake service and no running server.
 *
 *   GET    /api/officers/{id}/documents                    — list all active documents
 *   POST   /api/officers/{id}/documents                    — upload / replace a document (multipart)
 *   GET    /api/officers/{id}/documents/history            — version history for a document type
 *   GET    /api/officers/{id}/documents/{docId}            — one document by id
 *   GET    /api/officers/{id}/documents/{docId}/download   — download file with attachment headers
 *   DELETE /api/officers/{id}/documents/{docId}            — soft-delete a document
 */

import { z } from "zod";
import { badRequest, jsonError, jsonOk, notFound } from "@/lib/api/api_response";
import { officerIdParamSchema } from "@/lib/api/api_schemas";
import { DocumentUploadError, type DocumentUploadService } from "@/lib/document/document_upload_service";
import { DocumentRepository } from "@/lib/database/repositories/document_repository";

// ── Shared helpers ──────────────────────────────────────────────────────────

const docIdParamSchema = z.object({ docId: z.coerce.number().int().positive() });

function statusForCode(code: DocumentUploadError["code"]): number {
  switch (code) {
    case "UNSUPPORTED_TYPE":
    case "TOO_LARGE":
    case "EMPTY":
    case "VALIDATION":
      return 400;
    case "NOT_FOUND":
      return 404;
    case "STORAGE":
      return 502;
    default:
      return 400;
  }
}

function handleUploadError(error: unknown): Response {
  if (error instanceof DocumentUploadError) {
    return jsonError(error.code, error.message, statusForCode(error.code));
  }
  throw error;
}

/**
 * RFC 6266: the plain `filename=` parameter of Content-Disposition must be a
 * valid HTTP header ByteString (Latin-1, code points 0-255 only). The Web
 * Headers constructor enforces this strictly — passing a raw Thai (or any
 * non-Latin-1) filename directly throws:
 *   TypeError: Cannot convert argument to a ByteString because the
 *   character at index N has a value of M which is greater than 255.
 *
 * This is the confirmed root cause of the download 500 (see
 * handleDownloadDocument below): documents whose `originalFilename` contains
 * Thai characters (e.g. "ก.พ.7 ...pdf") crashed `new Headers({...})` at the
 * exact line building Content-Disposition, while ASCII-only filenames
 * (e.g. "733198.jpg") never hit this path — matching the observed behaviour
 * where some downloads worked and others returned 500.
 *
 * Fix: strip to printable ASCII for this fallback parameter only. The
 * accurate original name is always carried in `filename*` (RFC 5987, UTF-8
 * percent-encoded via encodeURIComponent) — percent-encoded output is
 * ASCII-only by construction, so it never hits the ByteString limit and
 * modern browsers use it in preference to the plain `filename=` parameter.
 */
function asciiFallbackFilename(filename: string, mimeType: string | null | undefined): string {
  const asciiOnly = filename.replace(/[^\x20-\x7E]/g, "").replace(/["\\]/g, "").trim();
  if (asciiOnly.length > 0) return asciiOnly;
  const ext = mimeType === "application/pdf" ? "pdf" : mimeType?.split("/")[1] ?? "bin";
  return `document.${ext}`;
}

/** Resolves the Officer's numeric PK from their string officerId. */
async function resolveOfficerPk(
  repository: DocumentRepository,
  officerId: string
): Promise<number | null> {
  // The repository wraps DatabaseClient; we need to look up the numeric PK
  // from officerId. We expose a helper for this via the repository's db access.
  // Rather than coupling to the full OfficerRepository, we use a minimal query
  // through the document repository's own db access surface.
  const rows = await (repository as unknown as { db: { officer: { findUnique: (a: object) => Promise<{ id: number } | null> } } }).db.officer.findUnique({
    where: { officerId },
  });
  return rows?.id ?? null;
}

// ── Handlers ───────────────────────────────────────────────────────────────

/**
 * GET — list all active documents for an officer, newest first.
 * Returns an empty array (not 404) when the officer has no documents yet.
 */
export async function handleListDocuments(
  service: DocumentUploadService,
  repository: DocumentRepository,
  rawOfficerId: string
): Promise<Response> {
  const parsed = officerIdParamSchema.safeParse({ id: rawOfficerId });
  if (!parsed.success) return badRequest("Invalid officer id");

  const officerPk = await resolveOfficerPk(repository, parsed.data.id);
  if (officerPk === null) return notFound("Officer not found.");

  const documents = await service.listActive(officerPk);
  return jsonOk(documents, { total: documents.length });
}

/**
 * POST — upload a new document for an officer (multipart/form-data).
 * Required fields: file (the document bytes), documentType, title.
 * Optional fields: description, uploadedBy.
 */
export async function handleUploadDocument(
  service: DocumentUploadService,
  repository: DocumentRepository,
  rawOfficerId: string,
  request: Request,
  uploadedBy: string | null = null
): Promise<Response> {
  const parsed = officerIdParamSchema.safeParse({ id: rawOfficerId });
  if (!parsed.success) return badRequest("Invalid officer id");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Request must be multipart/form-data.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return badRequest("Missing 'file' in the upload.");

  const documentType = (form.get("documentType") as string | null)?.trim();
  if (!documentType) return badRequest("Missing 'documentType' field.");

  const title = (form.get("title") as string | null)?.trim();
  if (!title) return badRequest("Missing 'title' field.");

  const description = (form.get("description") as string | null)?.trim() || null;
  const actorUploadedBy = uploadedBy ?? (form.get("uploadedBy") as string | null)?.trim() ?? null;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";

  const officerPk = await resolveOfficerPk(repository, parsed.data.id);
  if (officerPk === null) return notFound("Officer not found.");

  try {
    const doc = await service.upload({
      officerPk,
      officerId: parsed.data.id,
      documentType,
      title,
      description,
      bytes,
      mimeType,
      originalFilename: file.name || null,
      uploadedBy: actorUploadedBy,
    });
    return jsonOk(doc, undefined, 201);
  } catch (error) {
    return handleUploadError(error);
  }
}

/**
 * GET — retrieve a single document by id. 404 when not found or not linked
 * to this officer.
 */
export async function handleGetDocument(
  service: DocumentUploadService,
  rawOfficerId: string,
  rawDocId: string
): Promise<Response> {
  const officerParsed = officerIdParamSchema.safeParse({ id: rawOfficerId });
  if (!officerParsed.success) return badRequest("Invalid officer id");

  const docParsed = docIdParamSchema.safeParse({ docId: rawDocId });
  if (!docParsed.success) return badRequest("Invalid document id");

  const doc = await service.getById(docParsed.data.docId);
  if (!doc) return notFound("Document not found.");

  return jsonOk(doc);
}

/**
 * DELETE — version-aware soft-delete (PART 2 / PART 7).
 *
 * Soft-deletes the active current version (isActive=false) and automatically
 * promotes the next-latest inactive version to active so the document family
 * never exists without a "Current" badge while history entries remain.
 *
 * If this was the only version, `promoted` is null in the response — the
 * card reverts to "ยังไม่มี" (no document).
 *
 * 404 when the document does not exist or is already inactive. To delete
 * an already-inactive history entry, call handleDeleteVersion().
 */
export async function handleDeleteDocument(
  service: DocumentUploadService,
  rawOfficerId: string,
  rawDocId: string
): Promise<Response> {
  const officerParsed = officerIdParamSchema.safeParse({ id: rawOfficerId });
  if (!officerParsed.success) return badRequest("Invalid officer id");

  const docParsed = docIdParamSchema.safeParse({ docId: rawDocId });
  if (!docParsed.success) return badRequest("Invalid document id");

  const result = await service.softDeleteWithPromotion(docParsed.data.docId);
  if (!result) return notFound("Document not found or already inactive.");

  return jsonOk({
    id: result.deleted.id,
    isActive: false,
    promoted: result.promoted
      ? { id: result.promoted.id, version: result.promoted.version }
      : null,
  });
}

/**
 * DELETE (history) — deletes any version from the history panel (PART 3).
 *
 * Unlike handleDeleteDocument (which only operates on the active current
 * version), this handler accepts BOTH active and inactive versions:
 *   - Active version: soft-delete + auto-promote next version (same as above).
 *   - Inactive version: physically remove from DB (the user explicitly
 *     purged it from the version history).
 *
 * 404 when the document id does not exist.
 */
export async function handleDeleteVersion(
  service: DocumentUploadService,
  rawOfficerId: string,
  rawDocId: string
): Promise<Response> {
  const officerParsed = officerIdParamSchema.safeParse({ id: rawOfficerId });
  if (!officerParsed.success) return badRequest("Invalid officer id");

  const docParsed = docIdParamSchema.safeParse({ docId: rawDocId });
  if (!docParsed.success) return badRequest("Invalid document id");

  const result = await service.deleteVersion(docParsed.data.docId);
  if (!result) return notFound("Document version not found.");

  return jsonOk({
    id: result.deleted.id,
    isActive: false,
    promoted: result.promoted
      ? { id: result.promoted.id, version: result.promoted.version }
      : null,
  });
}

/**
 * GET download — proxies the stored file back to the client with
 * Content-Disposition: attachment so the browser downloads it rather than
 * opening it inline. Works for both images and PDFs.
 *
 * The file is fetched server-side from the stored publicUrl (Supabase
 * Storage) using cache: 'no-store' to bypass Next.js's fetch cache.
 * The entire body is buffered via arrayBuffer() before constructing the
 * Response — streaming upstream.body directly as the response body causes
 * Next.js's internal route-handler pipeline to conflict with the in-flight
 * ReadableStream, resulting in an unhandled error (500).
 */
export async function handleDownloadDocument(
  service: DocumentUploadService,
  rawOfficerId: string,
  rawDocId: string
): Promise<Response> {
  const officerParsed = officerIdParamSchema.safeParse({ id: rawOfficerId });
  if (!officerParsed.success) return badRequest("Invalid officer id");

  const docParsed = docIdParamSchema.safeParse({ docId: rawDocId });
  if (!docParsed.success) return badRequest("Invalid document id");

  const info = await service.getDownloadInfo(docParsed.data.docId);
  if (!info) return notFound("Document not found or has no stored file.");

  let upstream: globalThis.Response;
  try {
    // cache: 'no-store' prevents Next.js from caching binary file responses.
    upstream = await fetch(info.fileUrl, { cache: "no-store" });
  } catch (e) {
    return jsonError(
      "STORAGE",
      `Could not reach storage: ${e instanceof Error ? e.message : String(e)}`,
      502
    );
  }

  if (!upstream.ok) {
    return jsonError("STORAGE", `File not available (${upstream.status}).`, 502);
  }

  // Buffer the entire body — avoids ReadableStream piping issues in Next.js
  // route handlers and ensures Content-Length is always accurate.
  let buffer: ArrayBuffer;
  try {
    buffer = await upstream.arrayBuffer();
  } catch (e) {
    return jsonError(
      "STORAGE",
      `Failed to read file from storage: ${e instanceof Error ? e.message : String(e)}`,
      502
    );
  }

  // See asciiFallbackFilename() above — this is the ROOT CAUSE fix for the
  // 500 INTERNAL_ERROR: non-ASCII (e.g. Thai) filenames crash the Headers
  // constructor when passed raw into the plain filename= parameter.
  const safeFilename = asciiFallbackFilename(info.filename, info.mimeType);
  const headers = new Headers({
    "Content-Type": info.mimeType,
    "Content-Disposition":
      `attachment; filename="${safeFilename}"; ` +
      `filename*=UTF-8''${encodeURIComponent(info.filename)}`,
    "Content-Length": String(buffer.byteLength),
    "Cache-Control": "no-store",
  });

  return new Response(buffer, { headers });
}

/**
 * GET history — all versions (including inactive) for a document type,
 * newest first.
 */
export async function handleDocumentHistory(
  service: DocumentUploadService,
  repository: DocumentRepository,
  rawOfficerId: string,
  documentType: string
): Promise<Response> {
  const parsed = officerIdParamSchema.safeParse({ id: rawOfficerId });
  if (!parsed.success) return badRequest("Invalid officer id");

  if (!documentType?.trim()) return badRequest("Missing documentType.");

  const officerPk = await resolveOfficerPk(repository, parsed.data.id);
  if (officerPk === null) return notFound("Officer not found.");

  const history = await service.getHistory(officerPk, documentType.trim());
  return jsonOk(history, { total: history.length });
}
