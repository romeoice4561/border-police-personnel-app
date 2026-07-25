/**
 * Personnel Entity Resolution — shared types (Phase 51.1A).
 * Pure — no I/O, no HTTP, no messaging clients.
 */

/** Canonical entity kinds. Future kinds are reserved for extensibility. */
export const PERSONNEL_ENTITY_TYPES = [
  "region",
  "division",
  "company",
  "officer",
  "academy_class",
  "nickname",
  "position",
  "rank",
  "search_context",
  // Future-safe (not implemented yet):
  "operation_area",
  "checkpoint",
  "province",
  "station",
] as const;

export type PersonnelEntityType = (typeof PERSONNEL_ENTITY_TYPES)[number];

export type EntityMatchConfidence = "exact" | "alias" | "fuzzy" | "context";

export type OrganizationEntityType = "region" | "division" | "company";
