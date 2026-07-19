/**
 * DocumentRepository (Phase 29A — Officer Document Vault Foundation).
 *
 * Repository-pattern access for OfficerDocument rows over an injected
 * DatabaseClient. Follows the same injectable-fake pattern as
 * EducationRepository, TrainingRepository, SalaryHistoryRepository —
 * pure data access only, no business logic.
 *
 * Document versioning strategy:
 *   • Each upload creates a NEW row (never overwrites an existing one).
 *   • On "Replace", the prior active rows for that (officerId, documentType)
 *     are soft-deleted (isActive = false) before the new row is created.
 *   • History is permanent — isActive=false rows are never physically deleted.
 */

import type { DatabaseClient, OfficerDocument } from "@/lib/database/database_types";

export interface DocumentRowInput {
  documentType: string;
  title: string;
  description: string | null;
  storagePath: string | null;
  fileUrl: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  fileSize: number | null;
  uploadedAt: Date | null;
  uploadedBy: string | null;
  version: number;
}

export class DocumentRepository {
  constructor(private readonly db: DatabaseClient) {}

  /** All documents for an officer (every version, every type, newest first). */
  findAllForOfficer(officerId: number): Promise<OfficerDocument[]> {
    return this.db.officerDocument.findMany({
      where: { officerId },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Active documents only (isActive=true) for an officer, newest first. */
  findActiveForOfficer(officerId: number): Promise<OfficerDocument[]> {
    return this.db.officerDocument.findMany({
      where: { officerId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /** All versions (including inactive) for one (officerId, documentType), newest first. */
  findHistoryForType(officerId: number, documentType: string): Promise<OfficerDocument[]> {
    return this.db.officerDocument.findMany({
      where: { officerId, documentType },
      orderBy: { version: "desc" },
    });
  }

  /** Current active document for (officerId, documentType), or null if none. */
  async findActiveForType(officerId: number, documentType: string): Promise<OfficerDocument | null> {
    const rows = await this.db.officerDocument.findMany({
      where: { officerId, documentType, isActive: true },
      orderBy: { version: "desc" },
    });
    return rows[0] ?? null;
  }

  /** Finds a single document by id. */
  findById(id: number): Promise<OfficerDocument | null> {
    return this.db.officerDocument.findUnique({ where: { id } });
  }

  /** Creates a new document row. */
  create(officerId: number, input: DocumentRowInput): Promise<OfficerDocument> {
    return this.db.officerDocument.create({
      data: {
        officerId,
        documentType: input.documentType,
        title: input.title,
        description: input.description,
        storagePath: input.storagePath,
        fileUrl: input.fileUrl,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        uploadedAt: input.uploadedAt,
        uploadedBy: input.uploadedBy,
        version: input.version,
        isActive: true,
      },
    });
  }

  /**
   * Soft-deletes all active rows for a given (officerId, documentType) by
   * setting isActive=false. Returns the count of rows demoted. Used before
   * creating a new version (Replace flow).
   */
  async demoteActiveForType(officerId: number, documentType: string): Promise<number> {
    const result = await this.db.officerDocument.updateMany({
      where: { officerId, documentType, isActive: true },
      data: { isActive: false },
    });
    return result.count;
  }

  /**
   * Soft-deletes a single document row by id (isActive=false). Returns null
   * when the row doesn't exist or is already inactive.
   */
  async softDelete(id: number): Promise<OfficerDocument | null> {
    const existing = await this.findById(id);
    if (!existing || !existing.isActive) return null;
    return this.db.officerDocument.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /** The maximum version number currently stored for (officerId, documentType), or 0 if none. */
  async maxVersionForType(officerId: number, documentType: string): Promise<number> {
    const rows = await this.db.officerDocument.findMany({
      where: { officerId, documentType },
      orderBy: { version: "desc" },
    });
    return rows[0]?.version ?? 0;
  }

  /**
   * Promotes the most recently uploaded inactive version of a
   * (officerId, documentType) pair back to active. Called when the current
   * active version is deleted so the document family never becomes
   * "orphaned" (no active version despite having history).
   *
   * `excludeId` — the id of the version that was just soft-deleted. It is
   * now isActive=false too and must NOT be promoted back. Without this
   * exclusion, the just-deleted row would be the first candidate.
   *
   * Returns the promoted document, or null when no OTHER inactive versions
   * remain (i.e. the deleted version was the only history entry).
   */
  async promoteLatestInactiveForType(
    officerId: number,
    documentType: string,
    excludeId?: number
  ): Promise<OfficerDocument | null> {
    const rows = await this.db.officerDocument.findMany({
      where: { officerId, documentType, isActive: false },
      orderBy: { version: "desc" },
    });
    // Skip the row we just soft-deleted — it must not be re-promoted.
    const candidate = rows.find((r) => r.id !== excludeId);
    if (!candidate) return null;
    return this.db.officerDocument.update({
      where: { id: candidate.id },
      data: { isActive: true },
    });
  }

  /**
   * Physically removes an already-inactive (isActive=false) version from the
   * database. Used when a user explicitly removes an old version from the
   * history panel. Returns the deleted row, or null when:
   *   - The row does not exist.
   *   - The row is still active (use softDelete + promoteLatestInactiveForType
   *     for the active version — never physically delete it directly).
   */
  async hardDeleteInactive(id: number): Promise<OfficerDocument | null> {
    const existing = await this.findById(id);
    if (!existing || existing.isActive) return null;
    const result = await this.db.officerDocument.deleteMany({ where: { id } });
    return result.count > 0 ? existing : null;
  }

  countForOfficer(officerId: number): Promise<number> {
    return this.db.officerDocument.count({ where: { officerId } });
  }

  /**
   * Updates the editable metadata fields of a document row (Phase 46 — e-PF
   * Foundation). Only `title`/`description` are real, persisted columns on
   * OfficerDocument today — this never touches file bytes, version, or
   * active/inactive state. Returns null when the row doesn't exist.
   */
  async updateMetadata(
    id: number,
    input: { title?: string; description?: string | null }
  ): Promise<OfficerDocument | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    return this.db.officerDocument.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
    });
  }
}
