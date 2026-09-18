/**
 * Entity Media / Visual Identity — domain types.
 *
 * ONE ENTITY → MANY PHOTOS → ONE OPTIONAL PRIMARY.
 * Not officer portraits, not board canvas images, not gallery assets.
 */

export const DRUG_ENTITY_MEDIA_ENTITY_TYPES = [
  "PERSON",
  "VEHICLE",
  "CASE",
  "LOCATION",
  "SEIZED_ITEM",
  "DEVICE",
] as const;

export type DrugEntityMediaEntityType = (typeof DRUG_ENTITY_MEDIA_ENTITY_TYPES)[number];

export const DRUG_ENTITY_MEDIA_CATEGORIES = {
  PERSON: ["PROFILE", "ARREST", "DOCUMENT", "SURVEILLANCE", "SOCIAL_MEDIA", "OTHER"],
  VEHICLE: ["FRONT", "REAR", "LEFT", "RIGHT", "LICENSE_PLATE", "INTERIOR", "IDENTIFYING_MARK", "OTHER"],
  CASE: ["ARREST_SCENE", "SEIZED_ITEM", "OPERATION", "EVIDENCE", "DOCUMENT", "OTHER"],
  LOCATION: ["BUILDING", "HOUSE", "ENTRANCE", "SURROUNDING", "MAP_REFERENCE", "OTHER"],
  SEIZED_ITEM: ["PACKAGING", "EVIDENCE", "RELATED_OBJECT", "OTHER"],
  DEVICE: ["DEVICE", "IDENTIFIER", "OTHER"],
} as const satisfies Record<DrugEntityMediaEntityType, readonly string[]>;

export type DrugEntityMediaCategory<T extends DrugEntityMediaEntityType = DrugEntityMediaEntityType> =
  (typeof DRUG_ENTITY_MEDIA_CATEGORIES)[T][number];

export const ENTITY_MEDIA_VISUAL_TYPES = ["PERSON", "VEHICLE", "CASE"] as const;

export interface DrugEntityMediaActor {
  actorId: string;
  actorName: string;
}

export interface DrugEntityMediaVisual {
  mediaId: string;
  thumbnailUrl: string | null;
  expiresAt: string | null;
}

export interface DrugEntityMediaRecord {
  id: string;
  entityType: DrugEntityMediaEntityType;
  entityId: string;
  mediaType: "PHOTO";
  category: string;
  fileName: string | null;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  caption: string | null;
  description: string | null;
  isPrimary: boolean;
  sourceCaseId: string | null;
  capturedAt: string | null;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
  updatedAt: string;
  url: string | null;
  thumbnailUrl: string | null;
  expiresAt: string | null;
}

export function isDrugEntityMediaEntityType(value: string): value is DrugEntityMediaEntityType {
  return (DRUG_ENTITY_MEDIA_ENTITY_TYPES as readonly string[]).includes(value);
}

export function isDrugEntityMediaCategory(entityType: DrugEntityMediaEntityType, category: string): boolean {
  return (DRUG_ENTITY_MEDIA_CATEGORIES[entityType] as readonly string[]).includes(category);
}

export function defaultMediaCategory(entityType: DrugEntityMediaEntityType): string {
  if (entityType === "PERSON") return "PROFILE";
  if (entityType === "VEHICLE") return "FRONT";
  if (entityType === "CASE") return "EVIDENCE";
  if (entityType === "LOCATION") return "BUILDING";
  if (entityType === "DEVICE") return "DEVICE";
  return "OTHER";
}

export function visualLookupKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}
