/**
 * Portrait upload service (Phase 24B-1).
 *
 * Orchestrates the upload/replace/remove of an officer's portrait, reusing the
 * existing ProfilePhoto entity (no new storage table). The flow, per spec:
 *
 *   validate → store bytes (Supabase Storage) → persist metadata (ProfilePhoto)
 *   → flip prior current portrait to isProfile=false, new row isProfile=true
 *   → return the new current portrait.
 *
 * Invariants:
 *   • Portrait history is never destroyed — old portraits stay as rows with
 *     isProfile=false (spec: "Never delete old portraits").
 *   • Every uploaded portrait belongs to exactly one officer (matchedOfficerId
 *     set, matchStatus=MANUAL_MATCHED — a human uploaded it) and is a trusted
 *     portrait the resolver will display immediately.
 *   • If DB persistence fails after the bytes are stored, the stored object is
 *     removed (rollback) so no orphan file is left behind.
 *   • Google Drive is never touched — bytes live in Supabase Storage.
 *
 * Injected PortraitStorage + a narrow ProfilePhoto delegate, so it is fully
 * testable with fakes (no network, no live DB).
 */

import { randomUUID } from "node:crypto";
import type { PortraitStorage } from "@/lib/portrait/portrait_storage";
import { validatePortrait, readImageDimensions } from "@/lib/portrait/portrait_validation";

export const PORTRAIT_SOURCE_TYPE = "UPLOAD";
/** matchStatus for an uploaded portrait — a human explicitly linked it. */
export const PORTRAIT_MATCH_STATUS = "MANUAL_MATCHED";
/**
 * Phase 24B-2: an officer-uploaded portrait is self-evidently a real portrait
 * — the uploader chose and cropped it specifically as their portrait, so it
 * is classified REAL_PERSON immediately (no reviewer step needed) and
 * satisfies the resolver's Tier 4 "Verified Drive Portrait" semantics too.
 */
export const PORTRAIT_CLASSIFICATION = "REAL_PERSON";

/** One ProfilePhoto row, as this service reads/writes it (subset of the model). */
export interface PortraitRow {
  id: number;
  driveFileId: string;
  thumbnailUrl: string | null;
  webViewUrl: string | null;
  storagePath: string | null;
  matchedOfficerId: string | null;
  matchStatus: string;
  sourceType: string;
  isProfile: boolean;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  uploadedBy: string | null;
  classification: string;
  updatedAt: Date | string;
}

/** Narrow ProfilePhoto delegate the portrait service needs (write-side). */
export interface PortraitPhotoDelegate {
  findMany(args?: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;
  }): Promise<PortraitRow[]>;
  create(args: { data: Record<string, unknown> }): Promise<PortraitRow>;
  update(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<PortraitRow>;
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
}

export interface PortraitPhotoClient {
  profilePhoto: PortraitPhotoDelegate;
}

/** Public shape of a resolved portrait returned to callers. */
export interface OfficerPortrait {
  id: number;
  officerId: string;
  thumbnailUrl: string | null;
  webViewUrl: string | null;
  storagePath: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  uploadedBy: string | null;
  isProfile: boolean;
  updatedAt: string;
}

export interface UploadPortraitInput {
  officerId: string;
  bytes: Uint8Array;
  mimeType: string;
  /** Who performed the upload (actor id / name). Optional. */
  uploadedBy?: string | null;
}

export class PortraitUploadError extends Error {
  constructor(
    message: string,
    readonly code: "UNSUPPORTED_TYPE" | "TOO_LARGE" | "EMPTY" | "NOT_FOUND" | "STORAGE"
  ) {
    super(message);
    this.name = "PortraitUploadError";
  }
}

export interface PortraitUploadServiceDeps {
  db: PortraitPhotoClient;
  storage: PortraitStorage;
}

function toIso(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : v;
}

function rowToPortrait(row: PortraitRow): OfficerPortrait {
  return {
    id: row.id,
    officerId: row.matchedOfficerId ?? "",
    thumbnailUrl: row.thumbnailUrl,
    webViewUrl: row.webViewUrl,
    storagePath: row.storagePath,
    mimeType: row.mimeType,
    width: row.width,
    height: row.height,
    uploadedBy: row.uploadedBy,
    isProfile: row.isProfile,
    updatedAt: toIso(row.updatedAt),
  };
}

export class PortraitUploadService {
  private readonly db: PortraitPhotoClient;
  private readonly storage: PortraitStorage;

  constructor(deps: PortraitUploadServiceDeps) {
    this.db = deps.db;
    this.storage = deps.storage;
  }

  /** The officer's current portrait (isProfile=true), or null when none exists. */
  async getCurrentPortrait(officerId: string): Promise<OfficerPortrait | null> {
    const rows = await this.db.profilePhoto.findMany({
      where: { matchedOfficerId: officerId, isProfile: true },
      orderBy: { updatedAt: "desc" },
    });
    return rows.length > 0 ? rowToPortrait(rows[0]) : null;
  }

  /**
   * Uploads a new portrait and makes it the officer's current one. Validates
   * type/size, stores the bytes, persists a ProfilePhoto row, demotes the prior
   * current portrait (history preserved), and returns the new current portrait.
   * Rolls back the stored object if DB persistence fails.
   */
  async upload(input: UploadPortraitInput): Promise<OfficerPortrait> {
    const validation = validatePortrait({ mimeType: input.mimeType, byteLength: input.bytes.byteLength });
    if (!validation.ok) {
      throw new PortraitUploadError(validation.message, validation.code);
    }

    const dims = readImageDimensions(input.bytes);
    const driveFileId = `upload:${randomUUID()}`;
    const storagePath = `officers/${encodeOfficerSegment(input.officerId)}/${driveFileId.slice("upload:".length)}.${validation.extension}`;

    // 1. Store the bytes (Supabase Storage). Google Drive untouched.
    let stored;
    try {
      stored = await this.storage.put({ storagePath, bytes: input.bytes, mimeType: input.mimeType });
    } catch (error) {
      throw new PortraitUploadError(
        `Failed to store the portrait: ${error instanceof Error ? error.message : String(error)}`,
        "STORAGE"
      );
    }

    // 2. Persist metadata + link to officer. On failure, roll back the object.
    let created: PortraitRow;
    try {
      created = await this.db.profilePhoto.create({
        data: {
          driveFileId,
          thumbnailUrl: stored.thumbnailUrl,
          webViewUrl: stored.publicUrl,
          storagePath: stored.storagePath,
          filename: `${driveFileId.slice("upload:".length)}.${validation.extension}`,
          folderPath: storagePath,
          region: null,
          company: null,
          battalion: null,
          ocrText: null,
          ocrStatus: "PENDING",
          matchStatus: PORTRAIT_MATCH_STATUS,
          matchedOfficerId: input.officerId,
          confidence: 100,
          sourceType: PORTRAIT_SOURCE_TYPE,
          mimeType: input.mimeType,
          width: dims?.width ?? null,
          height: dims?.height ?? null,
          uploadedBy: input.uploadedBy ?? null,
          isProfile: true,
          classification: PORTRAIT_CLASSIFICATION,
          classifiedBy: input.uploadedBy ?? null,
          classifiedAt: new Date(),
        },
      });
    } catch (error) {
      await this.storage.remove(storagePath).catch(() => undefined);
      throw new PortraitUploadError(
        `Failed to save the portrait: ${error instanceof Error ? error.message : String(error)}`,
        "STORAGE"
      );
    }

    // 3. Demote every OTHER portrait for this officer (preserve history).
    await this.db.profilePhoto.updateMany({
      where: { matchedOfficerId: input.officerId, isProfile: true, NOT: { id: created.id } },
      data: { isProfile: false },
    });

    return rowToPortrait(created);
  }

  /**
   * Removes the officer's current portrait: demotes it to isProfile=false
   * (never deletes the row or the stored bytes — history is preserved). After
   * this the resolver falls back to the previous portrait or a placeholder.
   * Returns the officer's new current portrait (the most recent remaining one),
   * or null when none remains.
   */
  async removeCurrent(officerId: string): Promise<OfficerPortrait | null> {
    const demoted = await this.db.profilePhoto.updateMany({
      where: { matchedOfficerId: officerId, isProfile: true },
      data: { isProfile: false },
    });
    if (demoted.count === 0) {
      // Nothing was current; still fine (idempotent) — report current state.
      return this.getCurrentPortrait(officerId);
    }
    return this.getCurrentPortrait(officerId);
  }
}

/** Makes an officer id safe as a single storage path segment. */
function encodeOfficerSegment(officerId: string): string {
  return encodeURIComponent(officerId).replace(/%/g, "_");
}
