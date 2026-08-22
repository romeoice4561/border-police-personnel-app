/**
 * Network Intelligence / Link Analysis — domain types (Phase DI-5, Sections
 * 1-3, 6-9).
 *
 * Framework-agnostic: no React, no Next.js Request/Response, no @xyflow
 * import here — this module defines what a graph node/edge/path MEANS, not
 * how it's rendered. The web canvas (Section 8) and any future consumer
 * (Telegram, DI-8 dashboard drill-through) both build on this same
 * contract, mirroring drug_search_types.ts's role for DI-3.
 *
 * Section 17/18's neutral-language rule is enforced structurally here, not
 * just in UI copy: `edgeKind` forces every consumer to distinguish a
 * DIRECT relationship (a real junction-table row — e.g. this exact person
 * was recorded on this exact case) from an INFERRED one (two entities
 * share a case/phone/device — never proof of association). No edge is ever
 * unlabeled.
 */

export type DrugGraphNodeType = "PERSON" | "PHONE" | "SIM" | "DEVICE" | "VEHICLE" | "CASE" | "LOCATION";

/**
 * Section 1: every node type shares this shape so the graph engine (layout,
 * expansion, rendering) never special-cases entity type beyond `type`
 * itself and small per-type metadata fields. `maskedLabel` is the ALWAYS
 * -safe-to-render string (already masked per the caller's permission via
 * drug_sensitive_presentation.ts) — `label` may equal `maskedLabel` when no
 * unmasking applies (e.g. Person names, Case numbers are never masked).
 */
export interface DrugGraphNode {
  id: string;
  type: DrugGraphNodeType;
  /** Display label, already permission-appropriate — see maskedLabel note above. Never a raw unmasked value the caller shouldn't see. */
  label: string;
  secondaryLabel: string | null;
  /** Present ONLY when this node's primary identity is itself a sensitive value (Phone/SIM/Device/Vehicle) that masking could apply to. Equals `label` when nothing was masked (canViewFull=true) or when the node type has no maskable primary value (Person/Case/Location). */
  maskedLabel: string | null;
  metadata: DrugGraphNodeMetadata;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  caseCount: number;
  /** Section 1: risk/attention indicators surfaced without a "network graph = criminal network" implication — e.g. potential-duplicate person, entity reused across many cases. Never a verdict. */
  riskIndicators: DrugGraphRiskIndicator[];
}

export type DrugGraphRiskIndicator = "POTENTIAL_DUPLICATE_PERSON" | "HIGH_CASE_COUNT" | "MERGED_PERSON_HISTORICAL";

/** Per-node-type metadata — a discriminated union keyed by the node's own `type`, so a UI detail drawer can narrow without a separate lookup. */
export type DrugGraphNodeMetadata =
  | { type: "PERSON"; status: "ACTIVE" | "MERGED"; canonicalTarget: { entityId: string; primaryLabel: string } | null; hasPotentialDuplicate: boolean }
  | { type: "PHONE"; carrier: string | null }
  | { type: "SIM"; imsi: string | null; carrier: string | null }
  | { type: "DEVICE"; brand: string | null; model: string | null }
  | { type: "VEHICLE"; registrationProvince: string | null; brand: string | null; model: string | null; color: string | null }
  | { type: "CASE"; caseNumber: string; status: string; arrestDate: Date | null; province: string | null; reportingUnitText: string | null }
  | { type: "LOCATION"; province: string | null; district: string | null };

export type DrugGraphEdgeKind = "DIRECT" | "INFERRED";

/**
 * Section 2's direct edge kinds — one canonical relationshipType per pair
 * of node types that has an actual junction-table row backing it.
 */
export type DrugGraphDirectRelationshipType =
  | "PERSON_CASE"
  | "PERSON_PHONE"
  | "PERSON_SIM"
  | "PERSON_DEVICE"
  | "PERSON_VEHICLE"
  | "CASE_PHONE"
  | "CASE_SIM"
  | "CASE_DEVICE"
  | "CASE_VEHICLE"
  | "CASE_LOCATION";

/** Section 2's inferred edge kinds — Person↔Person only, always through a NAMED shared entity, never fabricated. */
export type DrugGraphInferredRelationshipType = "SHARED_CASE" | "SHARED_PHONE" | "SHARED_SIM" | "SHARED_DEVICE" | "SHARED_VEHICLE";

export type DrugGraphRelationshipType = DrugGraphDirectRelationshipType | DrugGraphInferredRelationshipType;

/**
 * Section 3: every edge carries enough provenance to answer "why does this
 * line exist" without a second round-trip. `explanation` is a short,
 * neutral, pre-composed Thai/English-ready message key context (built by
 * the service, never invented client-side) — see
 * drug_network_graph_explanation.ts for the actual i18n-key mapping.
 */
export interface DrugGraphEdge {
  id: string;
  source: string;
  target: string;
  relationshipType: DrugGraphRelationshipType;
  edgeKind: DrugGraphEdgeKind;
  /** For an INFERRED edge, how many shared entities/cases produced it (e.g. 2 shared cases). For a DIRECT edge, always 1 (one junction row = one edge). */
  evidenceCount: number;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  sourceCaseIds: string[];
  /** Machine-readable explanation facts — the UI composes the final sentence via drug_network_graph_explanation.ts, never invents new wording. */
  explanation: DrugGraphEdgeExplanation;
}

export type DrugGraphEdgeExplanation =
  | { kind: "DIRECT_ROLE"; role: string }
  | { kind: "DIRECT_LINK" }
  | { kind: "SHARED_CASES"; count: number }
  | { kind: "SHARED_PHONE" }
  | { kind: "SHARED_SIM" }
  | { kind: "SHARED_DEVICE" }
  | { kind: "SHARED_VEHICLE" };

export interface DrugGraphNeighborhood {
  focus: { entityType: DrugGraphNodeType; entityId: string };
  nodes: DrugGraphNode[];
  edges: DrugGraphEdge[];
  /** True when the server-side node cap (Section 4/19) truncated the result — the UI must show this, never silently drop entities. */
  truncated: boolean;
}

export interface DrugGraphNeighborhoodRequest {
  entityType: DrugGraphNodeType;
  entityId: string;
  /** 1 or 2 — Section 4's hop-depth ceiling. */
  depth: 1 | 2;
  nodeTypes?: DrugGraphNodeType[];
  relationshipTypes?: DrugGraphRelationshipType[];
  dateFrom?: Date;
  dateTo?: Date;
  /** Server clamps to DRUG_GRAPH_HARD_MAX_NODES regardless of what's requested (Section 4/19). */
  maxNodes?: number;
}

export interface DrugGraphPathStep {
  node: DrugGraphNode;
  /** The edge connecting this step to the PREVIOUS step — null for the first step (the path's origin). */
  viaEdge: DrugGraphEdge | null;
}

export interface DrugGraphPath {
  steps: DrugGraphPathStep[];
  hopCount: number;
}

export interface DrugGraphPathRequest {
  fromType: DrugGraphNodeType;
  fromId: string;
  toType: DrugGraphNodeType;
  toId: string;
  /** Section 5 — small bounded max, default/ceiling enforced server-side. */
  maxDepth?: number;
}

export interface DrugGraphPathResult {
  paths: DrugGraphPath[];
  /** True when no path was found within maxDepth — a deliberate, explainable "no connection found in recorded data" result, never an error. */
  found: boolean;
}

/** Section 4/19 — hard safety ceilings, never exceeded regardless of caller input. */
export const DRUG_GRAPH_DEFAULT_MAX_NODES = 50;
export const DRUG_GRAPH_HARD_MAX_NODES = 150;
export const DRUG_GRAPH_MAX_DEPTH = 2;
export const DRUG_GRAPH_PATH_MAX_DEPTH = 4;
