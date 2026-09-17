/**
 * Link Compare (LC-2A) — QUERY/ANALYSIS view types.
 *
 * Compares 2–3 DATABASE entities using existing DIRECT-edge path finding plus
 * independent case/identifier set intersection. Never writes intelligence.
 * QUERY CONDITION ≠ FACT. Absence of a path is not proof of no relationship.
 */

import type { DrugGraphNodeType, DrugGraphPath } from "@/lib/drug_intelligence/drug_network_graph_types";

export const DRUG_LINK_COMPARE_MIN_ENTITIES = 2;
export const DRUG_LINK_COMPARE_MAX_ENTITIES = 3;
export const DRUG_LINK_COMPARE_MAX_PATH_DEPTH = 3;
export const DRUG_LINK_COMPARE_MAX_VISITED = 150;
export const DRUG_LINK_COMPARE_MAX_SHARED_CASES = 20;
export const DRUG_LINK_COMPARE_MAX_SHARED_ENTITIES = 20;

export const DRUG_LINK_COMPARE_NONE_KNOWN_KEY = "di.linkCompare.noneKnown" as const;

/** Selectable compare endpoints. LOCATION is intentionally excluded. */
export type DrugLinkCompareEntityType = Exclude<DrugGraphNodeType, "LOCATION">;

export const DRUG_LINK_COMPARE_ENTITY_TYPES: readonly DrugLinkCompareEntityType[] = [
  "PERSON",
  "CASE",
  "PHONE",
  "SIM",
  "DEVICE",
  "VEHICLE",
];

export type DrugLinkCompareSlotKey = "A" | "B" | "C";
export type DrugLinkCompareSlotKind = "DATABASE" | "MANUAL" | "EMPTY";
export type DrugLinkCompareConnectionKind = "DIRECT" | "INDIRECT" | "NONE_KNOWN";

export type DrugLinkCompareValidationCode =
  | "INSUFFICIENT_DATABASE_ENTITIES"
  | "TOO_MANY_ENTITIES"
  | "DUPLICATE_ENTITY"
  | "UNSUPPORTED_TYPE"
  | "INVALID_SLOT";

export class DrugLinkCompareValidationError extends Error {
  readonly code: DrugLinkCompareValidationCode;
  constructor(code: DrugLinkCompareValidationCode, message: string) {
    super(message);
    this.name = "DrugLinkCompareValidationError";
    this.code = code;
  }
}

export interface DrugLinkCompareSlotInput {
  key: DrugLinkCompareSlotKey;
  kind: DrugLinkCompareSlotKind;
  entityType?: DrugGraphNodeType | DrugLinkCompareEntityType | null;
  entityId?: string | null;
  /** Future UI only — never passed to path finding, never persisted. */
  manualText?: string | null;
}

export interface DrugLinkCompareRequest {
  slots: DrugLinkCompareSlotInput[];
}

export interface DrugLinkCompareServiceOptions {
  canViewFull: boolean;
}

export interface DrugLinkCompareSlot {
  key: DrugLinkCompareSlotKey;
  kind: DrugLinkCompareSlotKind;
  entityType: DrugLinkCompareEntityType | null;
  entityId: string | null;
  label: string | null;
  caseCount: number | null;
}

export interface DrugLinkCompareSharedCase {
  caseId: string;
  caseNumber: string;
  label: string;
}

export interface DrugLinkCompareSharedEntity {
  entityType: Exclude<DrugLinkCompareEntityType, "CASE" | "PERSON">;
  entityId: string;
  label: string;
}

export interface DrugLinkComparePair {
  left: DrugLinkCompareSlotKey;
  right: DrugLinkCompareSlotKey;
  connectionKind: DrugLinkCompareConnectionKind;
  hopCount: number | null;
  shortestPath: DrugGraphPath | null;
  sharedCases: DrugLinkCompareSharedCase[];
  sharedEntities: DrugLinkCompareSharedEntity[];
  truncated: boolean;
  /** Set only for NONE_KNOWN — UI must not treat this as proof of no relationship. */
  absenceExplanationKey: typeof DRUG_LINK_COMPARE_NONE_KNOWN_KEY | null;
}

export interface DrugLinkCompareTripleIntersection {
  cases: DrugLinkCompareSharedCase[];
  entities: DrugLinkCompareSharedEntity[];
}

export interface DrugLinkCompareBounds {
  maxEntities: number;
  maxPathDepth: number;
  maxVisited: number;
}

export interface DrugLinkCompareResult {
  interpretation: { kind: "QUERY" };
  slots: DrugLinkCompareSlot[];
  pairs: DrugLinkComparePair[];
  tripleIntersection: DrugLinkCompareTripleIntersection | null;
  bounds: DrugLinkCompareBounds;
}
