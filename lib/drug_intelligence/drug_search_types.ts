/**
 * Global Intelligence Search — domain types (Phase DI-3, Sections 7-9, 35).
 *
 * Framework-agnostic: no React, no Next.js Request/Response types. This is
 * the exact contract DI-4's future Telegram integration must be able to
 * call directly (Section 35 — "Avoid coupling search logic to web UI...
 * Return typed domain results reusable by Web, Telegram, future API
 * consumers").
 */

import type { DrugSearchQueryClassification } from "@/lib/drug_intelligence/search_query_classifier";

export type DrugSearchEntityType = "PERSON" | "PHONE" | "SIM" | "DEVICE" | "VEHICLE" | "CASE";

export type DrugSearchMatchedField =
  | "PRIMARY_NAME"
  | "ALIAS"
  | "IDENTIFIER"
  | "PHONE_NUMBER"
  | "ICCID"
  | "IMSI"
  | "IMEI"
  | "SERIAL_NUMBER"
  | "REGISTRATION_NUMBER"
  | "VIN"
  | "CASE_NUMBER"
  | "CASE_TITLE";

/**
 * Section 19: ranking is deterministic and explainable — every result
 * carries the SAME strength vocabulary the DI-2 matching engine already
 * uses (never a numeric relevance score), so "why is this result first" is
 * always answerable from `matchedField` + `strength` alone.
 */
export type DrugSearchMatchStrength = "EXACT" | "PARTIAL";

/**
 * Section 9's unified typed result model. `entityId` is always the STABLE
 * canonical row id (Section 46 — DI-5 graph-readiness: every id here can
 * later become a graph focus node with no redesign). `canonicalTarget` is
 * populated only for PERSON results that resolved through a MERGED record
 * (Section 20) — the survivor's id/name, so the UI never has to make a
 * second round-trip to find out a result is stale.
 */
export interface DrugSearchResult {
  entityType: DrugSearchEntityType;
  entityId: string;
  primaryLabel: string;
  secondaryLabel: string | null;
  matchedField: DrugSearchMatchedField;
  /** The value that matched, ALREADY masked/unmasked per the caller's permission (Section 9 — "Do not expose raw sensitive values unnecessarily"). Never re-masked by the UI. */
  matchedValueMasked: string;
  strength: DrugSearchMatchStrength;
  firstSeen: Date | null;
  lastSeen: Date | null;
  caseCount: number;
  /** Only meaningful for PERSON results — null for every other entity type. */
  hasPotentialDuplicate: boolean | null;
  /** Only set when this PERSON result's underlying row is MERGED — points at the live survivor (Section 20). Always null for non-PERSON results. */
  canonicalTarget: { entityId: string; primaryLabel: string } | null;
}

export interface DrugSearchGroupedResults {
  query: string;
  classification: DrugSearchQueryClassification;
  totalCount: number;
  groups: Array<{
    entityType: DrugSearchEntityType;
    count: number;
    /** Top-N for this group in THIS response — see Section 24's "top N per group + ดูทั้งหมด" pagination design. Use the dedicated per-type search to page through a single group in full. */
    results: DrugSearchResult[];
  }>;
}

export interface DrugSearchFilters {
  entityType?: DrugSearchEntityType;
  dateFrom?: Date;
  dateTo?: Date;
  province?: string;
  headquartersId?: number;
  regionId?: number;
  battalionId?: number;
  companyId?: number;
  /** Section 22: "only entities with multiple cases" advanced filter. */
  minCaseCount?: number;
}

export interface DrugSearchRequest {
  query: string;
  filters?: DrugSearchFilters;
  /** Max results PER GROUP in the grouped-overview call (Section 24). */
  perGroupLimit?: number;
}

/** Section 24: single-entity-type paginated search, backing each group's "ดูทั้งหมด" drill-in. */
export interface DrugSearchByTypeRequest {
  query: string;
  entityType: DrugSearchEntityType;
  filters?: DrugSearchFilters;
  page: number;
  pageSize: number;
}
