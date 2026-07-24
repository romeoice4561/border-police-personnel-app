/**
 * Personnel Search Gateway — shared enums & lightweight domain types (Phase 51).
 * Pure — no I/O, no React, no messaging clients.
 */

export const SEARCH_INTENTS = [
  "UNIT_LOOKUP",
  "PERSON_LOOKUP",
  "PROMOTION_SEARCH",
  "RETIREMENT_SEARCH",
  "TRAINING_SEARCH",
  "DOCUMENT_SEARCH",
  "CONTACT_SEARCH",
  "DATA_QUALITY_SEARCH",
  "HELP",
  "UNKNOWN",
] as const;

export type SearchIntent = (typeof SEARCH_INTENTS)[number];

export const SEARCH_CLIENTS = ["web", "telegram", "line", "assistant", "api", "test"] as const;
export type SearchClient = (typeof SEARCH_CLIENTS)[number];

/** Progressive disclosure levels — Level 3 may include Web UI deep links. */
export type DisclosureLevel = 1 | 2 | 3;

export type SearchResultType =
  | "person"
  | "person_disambiguation"
  | "unit_summary"
  | "promotion_list"
  | "retirement_list"
  | "training_list"
  | "document_list"
  | "contact_list"
  | "data_quality_list"
  | "help"
  | "empty"
  | "error";

export type UnitLevel = "region" | "division" | "company";

export interface NormalizedUnitRef {
  level: UnitLevel;
  /** Canonical numeric token when parseable (e.g. 414, 41, 4). */
  number: number | null;
  /** Stable key for matching, e.g. "company:414", "division:41", "region:4". */
  key: string;
  labelTh: string;
  labelEn: string;
}

export interface NormalizedPersonQuery {
  raw: string;
  normalized: string;
  stripped: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  rankHint: string | null;
  officerIdHint: string | null;
  academyClass: number | null;
  positionHint: string | null;
}

export type MatchKind =
  | "exact_officer_id"
  | "exact_full_name"
  | "exact_nickname"
  | "exact_unit"
  | "prefix"
  | "fuzzy"
  | "field";
