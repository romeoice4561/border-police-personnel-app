/**
 * Relationship Search request/response domain types (Phase 1B).
 * Framework-agnostic — shared by service, API, and future Telegram/AI consumers.
 */

import type { DrugGraphNodeType, DrugGraphEdgeExplanation, DrugGraphEdgeKind } from "@/lib/drug_intelligence/drug_network_graph_types";
import type { DrugControlledRelationId } from "@/lib/drug_intelligence/drug_relationship_query_catalog";

export const DRUG_REL_QUERY_DEFAULT_PAGE_SIZE = 20;
export const DRUG_REL_QUERY_HARD_PAGE_SIZE = 50;
export const DRUG_REL_QUERY_DEFAULT_MAX_NODES = 50;
export const DRUG_REL_QUERY_HARD_MAX_NODES = 150;

export interface DrugRelationshipQueryRequest {
  source: { entityType: DrugGraphNodeType; entityId: string };
  relationId: DrugControlledRelationId | string;
  /** Target type is required so the catalog can constrain results; entityId optional for "any". */
  target: { entityType: DrugGraphNodeType; entityId?: string | null };
  page?: number;
  pageSize?: number;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface DrugRelationshipQueryEntityRef {
  entityType: DrugGraphNodeType;
  entityId: string;
  label: string;
  secondaryLabel: string | null;
}

export interface DrugRelationshipQueryResultItem {
  resultKind: "EDGE" | "PATH";
  edgeKind: DrugGraphEdgeKind | "PATH";
  relationshipType: string | null;
  relationId: string;
  from: DrugRelationshipQueryEntityRef;
  to: DrugRelationshipQueryEntityRef;
  evidenceCount: number;
  sourceCaseIds: string[];
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  explanation: DrugGraphEdgeExplanation | { kind: "PATH"; hopCount: number } | { kind: "PATH_NOT_FOUND" };
  /** Path hops when resultKind === PATH and found. */
  pathSteps?: Array<{
    entity: DrugRelationshipQueryEntityRef;
    viaRelationshipType: string | null;
    viaEdgeKind: DrugGraphEdgeKind | null;
  }>;
  actions: {
    detailPath: string | null;
    networkPath: string;
    timelinePath: string | null;
    mapPath: string | null;
    expandSource: { entityType: DrugGraphNodeType; entityId: string; label: string };
  };
}

export interface DrugRelationshipQueryResponse {
  interpretation: {
    kind: "QUERY";
    source: { entityType: DrugGraphNodeType; entityId: string };
    relationId: string;
    target: { entityType: DrugGraphNodeType; entityId: string | null };
  };
  summary: {
    total: number;
    byTargetType: Partial<Record<DrugGraphNodeType, number>>;
    found: boolean;
  };
  results: DrugRelationshipQueryResultItem[];
  truncated: boolean;
  bounds: {
    page: number;
    pageSize: number;
    maxNodes: number;
    depth: number;
  };
}

export interface DrugRelationshipQueryServiceOptions {
  canViewFull: boolean;
  actorId?: string;
  actorName?: string;
}

export class DrugRelationshipQueryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DrugRelationshipQueryValidationError";
  }
}

export class DrugRelationshipQueryEntityNotFoundError extends Error {
  constructor(public readonly entityType: DrugGraphNodeType, public readonly entityId: string) {
    super(`Entity not found: ${entityType}/${entityId}`);
    this.name = "DrugRelationshipQueryEntityNotFoundError";
  }
}
