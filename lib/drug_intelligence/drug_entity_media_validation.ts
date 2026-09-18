/**
 * Entity-media path + category helpers. Byte validation reuses the
 * investigation-board image authority (magic bytes, MIME, size, no SVG).
 */

import {
  BoardImageValidationError,
  extensionForBoardImageMime,
  sanitizeOriginalFilename,
  validateBoardImageBytes,
} from "@/lib/drug_intelligence/drug_investigation_board_image_validation";
import {
  defaultMediaCategory,
  isDrugEntityMediaCategory,
  isDrugEntityMediaEntityType,
  type DrugEntityMediaEntityType,
} from "@/lib/drug_intelligence/drug_entity_media_types";

export {
  BoardImageValidationError as EntityMediaValidationError,
  sanitizeOriginalFilename,
  validateBoardImageBytes,
  extensionForBoardImageMime,
};

const ID_RE = /^[A-Za-z0-9_-]+$/;

export function buildEntityMediaStoragePath(
  entityType: DrugEntityMediaEntityType,
  entityId: string,
  mediaId: string,
  ext: string
): string {
  if (!ID_RE.test(entityId) || !ID_RE.test(mediaId) || !/^[a-z0-9]+$/.test(ext)) {
    throw new BoardImageValidationError("UNSUPPORTED_TYPE");
  }
  return `entities/${entityType}/${entityId}/${mediaId}.${ext}`;
}

export function resolveMediaCategory(
  entityType: DrugEntityMediaEntityType,
  category: string | null | undefined
): string {
  const value = (category ?? "").trim().toUpperCase();
  if (!value) return defaultMediaCategory(entityType);
  if (!isDrugEntityMediaCategory(entityType, value)) {
    throw new EntityMediaCategoryError(entityType, value);
  }
  return value;
}

export function parseEntityMediaType(value: string): DrugEntityMediaEntityType {
  const normalized = value.trim().toUpperCase();
  if (!isDrugEntityMediaEntityType(normalized)) {
    throw new EntityMediaCategoryError("PERSON", normalized);
  }
  return normalized;
}

export class EntityMediaCategoryError extends Error {
  readonly code = "INVALID_CATEGORY";
  constructor(public readonly entityType: string, public readonly category: string) {
    super(`Invalid media category '${category}' for ${entityType}`);
    this.name = "EntityMediaCategoryError";
  }
}

export class EntityMediaNotFoundError extends Error {
  readonly code = "ENTITY_MEDIA_NOT_FOUND";
  constructor() {
    super("Media is unavailable");
    this.name = "EntityMediaNotFoundError";
  }
}

export class EntityMediaTargetNotFoundError extends Error {
  readonly code = "ENTITY_NOT_FOUND";
  constructor(entityType: string, entityId: string) {
    super(`${entityType} '${entityId}' was not found`);
    this.name = "EntityMediaTargetNotFoundError";
  }
}

export class EntityMediaMergedWriteError extends Error {
  readonly code = "MERGED_PERSON";
  constructor() {
    super("Photos for a merged person must be uploaded on the surviving record");
    this.name = "EntityMediaMergedWriteError";
  }
}
