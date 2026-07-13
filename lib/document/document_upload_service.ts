/**
 * Officer Document Upload Service (Phase 29A / 29B — Officer Document Vault).
 *
 * Orchestrates the upload/replace/list/delete of an officer's documents.
 * Reuses the existing PortraitStorage interface (same Supabase Storage REST
 * API, different bucket and path namespace) — no duplicated upload logic.
 *
 * Storage path template:
 *   officers/{encodedOfficerId}/documents/{documentType}/{uuid}.{ext}
 *
 * Versioning invariants:
 *   • Every upload creates a NEW row — no row is ever physically deleted.
 *   • "Replace" demotes all prior active rows for that type to isActive=false
 *     before creating the new row, so history is permanently preserved.
 *   • "Upload" (first upload for a type) sets version=1.
 *   • "Replace" (subsequent uploads) sets version = prior_max + 1.
 *   • If DB persistence fails after bytes are stored, the stored object is
 *     removed (rollback), so no orphan file is left behind.
 *
 * Injected PortraitStorage + DocumentRepository so the service is fully
 * testable with in-memory fakes (no network, no live DB).
 */

import { randomUUID } from "node:crypto";
import type { PortraitStorage } from "@/lib/portrait/portrait_storage";
import { validateDocument } from "@/lib/document/document_validation";
import type { DocumentRepository } from "@/lib/database/repositories/document_repository";
import type { OfficerDocument } from "@/lib/database/database_types";

export type { OfficerDocument };

export class DocumentUploadError extends Error {
  constructor(
    message: string,
    readonly code: "UNSUPPORTED_TYPE" | "TOO_LARGE" | "EMPTY" | "NOT_FOUND" | "STORAGE" | "VALIDATION"
  ) {
    super(message);
    this.name = "DocumentUploadError";
  }
}

export interface UploadDocumentInput {
  /** Numeric PK of the Officer row (not the officerId string). */
  officerPk: number;
  /** The officer's string id (for storage path namespacing). */
  officerId: string;
  documentType: string;
  title: string;
  description?: string | null;
  bytes: Uint8Array;
  mimeType: string;
  originalFilename?: string | null;
  uploadedBy?: string | null;
}

export interface DocumentUploadServiceDeps {
  repository: DocumentRepository;
  storage: PortraitStorage;
}

function encodeOfficerSegment(officerId: string): string {
  return encodeURIComponent(officerId).replace(/%/g, "_");
}

export class DocumentUploadService {
  private readonly repository: DocumentRepository;
  private readonly storage: PortraitStorage;

  constructor(deps: DocumentUploadServiceDeps) {
    this.repository = deps.repository;
    this.storage = deps.storage;
  }

  /** All active documents for an officer (current version of each type), newest first. */
  listActive(officerPk: number): Promise<OfficerDocument[]> {
    return this.repository.findActiveForOfficer(officerPk);
  }

  /** All versions for a specific document type (history), newest version first. */
  getHistory(officerPk: number, documentType: string): Promise<OfficerDocument[]> {
    return this.repository.findHistoryForType(officerPk, documentType);
  }

  /** A single document by id, or null if not found. */
  getById(id: number): Promise<OfficerDocument | null> {
    return this.repository.findById(id);
  }

  /**
   * Uploads a file and persists an OfficerDocument row. Automatically:
   *   1. Validates file type/size.
   *   2. Stores the bytes in Supabase Storage.
   *   3. Demotes any prior active rows for the same type (Replace flow).
   *   4. Creates the new row with version = prior_max + 1 (or 1 if none).
   *   5. Rolls back the stored bytes on DB failure.
   */
  async upload(input: UploadDocumentInput): Promise<OfficerDocument> {
    const validation = validateDocument({ mimeType: input.mimeType, byteLength: input.bytes.byteLength });
    if (!validation.ok) {
      throw new DocumentUploadError(validation.message, validation.code);
    }

    const uuid = randomUUID();
    const storagePath = [
      "officers",
      encodeOfficerSegment(input.officerId),
      "documents",
      input.documentType,
      `${uuid}.${validation.extension}`,
    ].join("/");

    let stored: { storagePath: string; publicUrl: string; thumbnailUrl: string };
    try {
      stored = await this.storage.put({ storagePath, bytes: input.bytes, mimeType: input.mimeType });
    } catch (error) {
      throw new DocumentUploadError(
        `Failed to store the document: ${error instanceof Error ? error.message : String(error)}`,
        "STORAGE"
      );
    }

    const priorMax = await this.repository.maxVersionForType(input.officerPk, input.documentType);
    const nextVersion = priorMax + 1;

    if (nextVersion > 1) {
      await this.repository.demoteActiveForType(input.officerPk, input.documentType);
    }

    let created: OfficerDocument;
    try {
      created = await this.repository.create(input.officerPk, {
        documentType: input.documentType,
        title: input.title,
        description: input.description ?? null,
        storagePath: stored.storagePath,
        fileUrl: stored.publicUrl,
        originalFilename: input.originalFilename ?? null,
        mimeType: input.mimeType,
        fileSize: input.bytes.byteLength,
        uploadedAt: new Date(),
        uploadedBy: input.uploadedBy ?? null,
        version: nextVersion,
      });
    } catch (error) {
      await this.storage.remove(storagePath).catch(() => undefined);
      throw new DocumentUploadError(
        `Failed to save the document: ${error instanceof Error ? error.message : String(error)}`,
        "STORAGE"
      );
    }

    return created;
  }

  /**
   * Soft-deletes a document (isActive=false). The row and stored bytes are
   * never physically deleted — history is permanent.
   * Returns null when the row doesn't exist or is already inactive.
   */
  softDelete(id: number): Promise<OfficerDocument | null> {
    return this.repository.softDelete(id);
  }

  /**
   * Returns the minimal metadata required to serve a file download:
   * the public URL, the original filename, and the MIME type.
   * Returns null when the document does not exist, is inactive, or has no
   * stored file (e.g. a metadata-only row with no uploaded bytes).
   */
  async getDownloadInfo(id: number): Promise<{ fileUrl: string; filename: string; mimeType: string } | null> {
    const doc = await this.repository.findById(id);
    if (!doc || !doc.isActive || !doc.fileUrl) return null;
    return {
      fileUrl: doc.fileUrl,
      filename: doc.originalFilename ?? `document-${doc.id}`,
      mimeType: doc.mimeType ?? "application/octet-stream",
    };
  }
}
