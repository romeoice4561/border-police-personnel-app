/**
 * DI-8.7 V1 — Deterministic Intelligence Graph Observations.
 *
 * PURE ANALYSIS ONLY. No DB calls, no API calls, no React, no side effects.
 * Consumes the exact same already-loaded, already-bounded
 * DrugGraphNeighborhoodResponse the Network Inspector already has (see
 * DrugNetworkGraphService — DRUG_GRAPH_DEFAULT_MAX_NODES=50,
 * DRUG_GRAPH_HARD_MAX_NODES=150, DRUG_GRAPH_MAX_DEPTH=2). Zero new queries,
 * zero new server aggregation — matching the DI-8.5 area×temporal-pattern
 * precedent (derive from the already-fetched, already-bounded client
 * dataset only).
 *
 * NOT a second graph engine, NOT a relationship classifier, NOT a risk
 * score. An "observation" (NetworkGraphInsight) is a strictly separate
 * concept from DrugGraphEdgeKind ("DIRECT"|"INFERRED") — it is a
 * presentation/analysis result derived from recorded graph data, never an
 * edge classification, and it must never be added to DrugGraphEdgeKind.
 *
 * Masking is inherited for free: DrugNetworkGraphService already applies
 * presentIdentifierValue/presentPhoneNumber to every node's label/
 * secondaryLabel at fetch time (canViewFull-gated), so this module only
 * ever reads already-correctly-masked strings — it never needs canViewFull
 * itself and can never create an insight-only masking bypass, because there
 * is nothing left here to mask.
 *
 * Canonical PERSON merge safety is inherited for free too: every node here
 * was already resolved through DrugNetworkGraphService's
 * resolveCanonicalPersonId before reaching this module.
 *
 * Language discipline (non-negotiable, enforced by tests):
 * - Never "ผู้ต้องสงสัยสำคัญ", "เครือข่ายเดียวกัน", "ร่วมขบวนการ",
 *   "ติดต่อกัน", "ผู้ค้ายา", "เสี่ยงสูง", or any risk/danger/association
 *   language not explicitly present in the recorded data.
 * - Every insight names its exact supporting case ids — never just a count.
 * - Every insight carries a mandatory deterministic "เหตุที่ระบบแสดง" reason.
 * - Same-day observations are a temporal fact only — never coordination,
 *   meeting, communication, or a causal claim.
 * - Ordering is by transparent metric only ("เรียงตามจำนวนคดีที่ปรากฏ"),
 *   never "ความสำคัญ"/risk.
 */

import type {
  DrugGraphEdge,
  DrugGraphNeighborhoodResponse,
  DrugGraphNode,
  DrugGraphNodeType,
} from "@/lib/drug_intelligence/drug_intelligence_client";
import { classifyCaseChronology, toDateOnly } from "@/lib/drug_intelligence/drug_cross_case_connection";
import type { TranslationKey } from "@/lib/i18n/dictionary";

/** Entity types that can meaningfully repeat across cases in this graph model — mirrors what DrugNetworkGraphService actually loads, never invented. CASE/LOCATION are excluded: a case cannot "appear in itself," and LOCATION-sharing is explicitly never relationship evidence (see drug_cross_case_connection.ts). */
const CROSS_CASE_ENTITY_TYPES: readonly DrugGraphNodeType[] = ["PERSON", "PHONE", "SIM", "DEVICE", "VEHICLE"];

/** Minimum distinct cases before a cross-case/repeated-entity observation is surfaced. */
export const INSIGHT_MIN_DISTINCT_CASES = 2;
/** Initial visible card count (Section 12) — progressive disclosure, same philosophy as DI-8.5's AREA_TEMPORAL_INITIAL_LIMIT. */
export const INSIGHT_INITIAL_LIMIT = 3;
/** Hard cap on total generated insights per selected entity, regardless of how many qualify. */
export const INSIGHT_MAX_TOTAL = 12;

export type NetworkGraphInsightType =
  | "CROSS_CASE_ENTITY"
  | "SHARED_CONNECTION"
  | "COMMON_EVIDENCE"
  | "SAME_DAY_CASES";

/** One case reference as shown on an insight card — always the real case node's number when loaded, never a raw id alone. */
export interface InsightCaseRef {
  caseId: string;
  /** caseNumber when the CASE node is loaded in this neighborhood; falls back to caseId only if the case node itself wasn't loaded (e.g. referenced only via edge.sourceCaseIds). Never fabricated. */
  caseNumber: string;
  arrestDate: string | null;
}

/** Graph-focus payload for "ดูบนผัง" — real loaded node/edge ids only, never invented. Reuses the exact {nodeIds, edgeIds} shape the flow adapter's emphasizedPath prop already accepts (see drug_network_graph_flow_adapter.ts) — no new highlight mechanism. */
export interface InsightGraphFocus {
  nodeIds: string[];
  edgeIds: string[];
  /** The node id to select (drives the existing selectedSecondaryId / Inspector-open mechanism) — the insight's primary entity, or the first case node for a same-day observation. */
  primaryNodeId: string | null;
}

export interface NetworkGraphInsight {
  id: string;
  type: NetworkGraphInsightType;
  /** "What did the system notice?" — Section 11.A. */
  titleKey: TranslationKey;
  /** The primary entity this insight is about (null for SAME_DAY_CASES, which is case-centric, not entity-centric). */
  entityId: string | null;
  entityType: DrugGraphNodeType | null;
  /** Already-masked display label, read straight from the loaded node — never re-derived. */
  entityLabel: string | null;
  /** The deterministic fact — Section 11.C, e.g. "พบใน 2 คดี". */
  factText: string;
  /** Exact supporting cases — Section 11.D. Never just a count. */
  cases: InsightCaseRef[];
  /** Mandatory deterministic trigger explanation — Section 11.E / Section 14. */
  reasonKey: TranslationKey;
  /** Real loaded node/edge ids only — Section 15/16, never mutates graph data. */
  graphFocus: InsightGraphFocus;
  /** Ordering metric, exposed so the UI can render "เรียงตามจำนวนคดีที่ปรากฏ" honestly (Section 19). */
  metric: number;
}

function nodeById(nodes: readonly DrugGraphNode[]): Map<string, DrugGraphNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

/** Resolves case ids to InsightCaseRef using loaded CASE nodes when present; never fabricates a case number for an id that isn't actually loaded. */
function resolveCaseRefs(caseIds: readonly string[], byId: Map<string, DrugGraphNode>): InsightCaseRef[] {
  const seen = new Set<string>();
  const out: InsightCaseRef[] = [];
  for (const caseId of caseIds) {
    if (seen.has(caseId)) continue;
    seen.add(caseId);
    const node = byId.get(caseId);
    const arrestDate = node && node.metadata.type === "CASE" ? node.metadata.arrestDate : null;
    out.push({
      caseId,
      caseNumber: node && node.metadata.type === "CASE" ? node.metadata.caseNumber : caseId,
      arrestDate,
    });
  }
  return out.sort((a, b) => a.caseNumber.localeCompare(b.caseNumber, "th"));
}

/**
 * V1 Insight #1 — Cross-case / repeated entity.
 * Surfaces every loaded PERSON/PHONE/SIM/DEVICE/VEHICLE node whose own
 * caseCount (already computed by DrugNetworkGraphService) is >= 2, using
 * the edges touching that node to recover the EXACT supporting case ids
 * (via edge.sourceCaseIds) rather than just repeating the count.
 */
function computeCrossCaseEntityInsights(
  neighborhood: DrugGraphNeighborhoodResponse,
  byId: Map<string, DrugGraphNode>,
): NetworkGraphInsight[] {
  const out: NetworkGraphInsight[] = [];
  for (const node of neighborhood.nodes) {
    if (!CROSS_CASE_ENTITY_TYPES.includes(node.type)) continue;
    // Gather every case id referenced by an edge touching this node — the
    // real, exact supporting cases, not a re-derivation of caseCount.
    const caseIds = new Set<string>();
    const edgeIds: string[] = [];
    for (const edge of neighborhood.edges) {
      if (edge.source !== node.id && edge.target !== node.id) continue;
      for (const caseId of edge.sourceCaseIds) caseIds.add(caseId);
      edgeIds.push(edge.id);
    }
    if (caseIds.size < INSIGHT_MIN_DISTINCT_CASES) continue;
    const cases = resolveCaseRefs([...caseIds], byId);
    out.push({
      id: `cross-case:${node.id}`,
      type: "CROSS_CASE_ENTITY",
      titleKey: crossCaseTitleKeyFor(node.type),
      entityId: node.id,
      entityType: node.type,
      entityLabel: node.label,
      factText: `พบใน ${cases.length} คดี`,
      cases,
      reasonKey: crossCaseReasonKeyFor(node.type),
      graphFocus: {
        nodeIds: [node.id, ...cases.map((c) => c.caseId).filter((id) => byId.has(id))],
        edgeIds,
        primaryNodeId: node.id,
      },
      metric: cases.length,
    });
  }
  return out;
}

function crossCaseTitleKeyFor(type: DrugGraphNodeType): TranslationKey {
  switch (type) {
    case "PHONE":
      return "di.network.insightCrossCasePhone";
    case "SIM":
      return "di.network.insightCrossCaseSim";
    case "DEVICE":
      return "di.network.insightCrossCaseDevice";
    case "VEHICLE":
      return "di.network.insightCrossCaseVehicle";
    case "PERSON":
      return "di.network.insightCrossCasePerson";
    default:
      return "di.network.insightCrossCaseGeneric";
  }
}

function crossCaseReasonKeyFor(type: DrugGraphNodeType): TranslationKey {
  switch (type) {
    case "PHONE":
      return "di.network.insightReasonCrossCasePhone";
    case "SIM":
      return "di.network.insightReasonCrossCaseSim";
    case "DEVICE":
      return "di.network.insightReasonCrossCaseDevice";
    case "VEHICLE":
      return "di.network.insightReasonCrossCaseVehicle";
    case "PERSON":
      return "di.network.insightReasonCrossCasePerson";
    default:
      return "di.network.insightReasonCrossCaseGeneric";
  }
}

/**
 * V1 Insight #2 — Shared connection.
 * Surfaces the already-computed INFERRED SHARED_* edges DrugNetworkGraphService's
 * deriveInferredPersonEdges already produces WITHIN this loaded neighborhood
 * (two PERSON nodes sharing a CASE/PHONE/SIM/DEVICE/VEHICLE neighbor). This
 * insight does not invent a new relationship — it re-presents an edge that
 * already exists in the loaded graph as a plain-language observation.
 */
function computeSharedConnectionInsights(
  neighborhood: DrugGraphNeighborhoodResponse,
  byId: Map<string, DrugGraphNode>,
): NetworkGraphInsight[] {
  const out: NetworkGraphInsight[] = [];
  for (const edge of neighborhood.edges) {
    if (edge.edgeKind !== "INFERRED") continue;
    const a = byId.get(edge.source);
    const b = byId.get(edge.target);
    if (!a || !b) continue;
    // The shared entity itself isn't named on a SHARED_* edge directly —
    // recover it via sourceCaseIds when the relationship is case-mediated,
    // otherwise fall back to naming it generically from the relationship
    // type's own entity-kind (never inventing an id that isn't loaded).
    const sharedCaseIds = edge.sourceCaseIds;
    const cases = resolveCaseRefs(sharedCaseIds, byId);
    if (cases.length === 0) continue; // no recoverable shared case -> nothing concrete to show; do not fabricate.
    const factText =
      cases.length === 1
        ? `มีข้อมูลร่วมผ่านคดี ${cases[0]!.caseNumber}`
        : `มีข้อมูลร่วมผ่าน ${cases.length} คดี`;
    out.push({
      id: `shared:${edge.id}`,
      type: "SHARED_CONNECTION",
      titleKey: "di.network.insightSharedConnection",
      entityId: null,
      entityType: null,
      entityLabel: `${a.label} · ${b.label}`,
      factText,
      cases,
      reasonKey: "di.network.insightReasonSharedConnection",
      graphFocus: {
        nodeIds: [a.id, b.id, ...cases.map((c) => c.caseId).filter((id) => byId.has(id))],
        edgeIds: [edge.id],
        primaryNodeId: a.id,
      },
      metric: cases.length,
    });
  }
  return out;
}

/**
 * V1 Insight #3 — Common evidence across cases.
 * Generalizes the inverted-index pattern discovered in
 * analyzeHotspotCrossCaseEvidence (drug_geo_hotspot_evidence.ts) — built
 * fresh here rather than imported, because that function is scoped to a
 * hotspot's case-id set with its own DB-loaded membership rows; this
 * version operates purely on the already-loaded neighborhood's CASE nodes
 * and edges, with no DB access. Algorithm: one pass over loaded edges
 * builds entityKey -> Set<caseId>; O(edges), never O(cases^2).
 */
function computeCommonEvidenceInsights(
  neighborhood: DrugGraphNeighborhoodResponse,
  byId: Map<string, DrugGraphNode>,
): NetworkGraphInsight[] {
  const caseIdsByEntity = new Map<string, Set<string>>();
  for (const edge of neighborhood.edges) {
    if (edge.sourceCaseIds.length === 0) continue;
    // The "entity" for this purpose is whichever endpoint is NOT a CASE —
    // a CASE_PHONE/CASE_DEVICE/... edge names the phone/device as the
    // shared item; a PERSON_CASE edge names the person.
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    const entityNode = source?.type !== "CASE" ? source : target?.type !== "CASE" ? target : null;
    if (!entityNode) continue;
    const set = caseIdsByEntity.get(entityNode.id) ?? new Set<string>();
    for (const caseId of edge.sourceCaseIds) set.add(caseId);
    caseIdsByEntity.set(entityNode.id, set);
  }

  const out: NetworkGraphInsight[] = [];
  for (const [entityId, caseIdSet] of caseIdsByEntity) {
    if (caseIdSet.size < INSIGHT_MIN_DISTINCT_CASES) continue;
    const entityNode = byId.get(entityId);
    if (!entityNode) continue;
    const cases = resolveCaseRefs([...caseIdSet], byId);
    if (cases.length < INSIGHT_MIN_DISTINCT_CASES) continue; // some case ids may not resolve to loaded nodes
    const edgeIds = neighborhood.edges
      .filter((e) => e.source === entityId || e.target === entityId)
      .map((e) => e.id);
    out.push({
      id: `common-evidence:${entityId}`,
      type: "COMMON_EVIDENCE",
      titleKey: "di.network.insightCommonEvidence",
      entityId,
      entityType: entityNode.type,
      entityLabel: entityNode.label,
      factText: `ปรากฏใน ${cases.length} คดี`,
      cases,
      reasonKey: "di.network.insightReasonCommonEvidence",
      graphFocus: {
        nodeIds: [entityId, ...cases.map((c) => c.caseId).filter((id) => byId.has(id))],
        edgeIds,
        primaryNodeId: entityId,
      },
      metric: cases.length,
    });
  }
  return out;
}

/**
 * V1 Insight #4 — Same-day recorded case observation.
 * Reuses classifyCaseChronology (drug_cross_case_connection.ts) exactly —
 * no new date-comparison logic. Only compares CASE nodes actually loaded in
 * this neighborhood; pairwise over loaded CASE nodes only (bounded by
 * DRUG_GRAPH_HARD_MAX_NODES=150 total nodes, so at most 150 cases — safe).
 * A temporal fact only: never coordination, meeting, communication, or a
 * causal claim.
 */
function computeSameDayInsights(neighborhood: DrugGraphNeighborhoodResponse): NetworkGraphInsight[] {
  const caseNodes = neighborhood.nodes.filter((n) => n.type === "CASE" && n.metadata.type === "CASE");
  const groups = new Map<string, DrugGraphNode[]>();
  for (const node of caseNodes) {
    if (node.metadata.type !== "CASE") continue;
    const dateOnly = toDateOnly(node.metadata.arrestDate);
    if (!dateOnly) continue;
    const list = groups.get(dateOnly) ?? [];
    list.push(node);
    groups.set(dateOnly, list);
  }
  const out: NetworkGraphInsight[] = [];
  for (const [dateOnly, nodes] of groups) {
    if (nodes.length < INSIGHT_MIN_DISTINCT_CASES) continue;
    // Confirm via the canonical chronology function itself (never re-derive
    // date equality independently) — sanity-check every pair actually
    // classifies as SAME_DAY per the shared primitive.
    const allSameDay = nodes.every((n, i) => {
      if (i === 0) return true;
      const a = nodes[0]!;
      if (a.metadata.type !== "CASE" || n.metadata.type !== "CASE") return false;
      return classifyCaseChronology(a.metadata.arrestDate, n.metadata.arrestDate) === "SAME_DAY";
    });
    if (!allSameDay) continue;
    const cases: InsightCaseRef[] = nodes
      .map((n) => ({
        caseId: n.id,
        caseNumber: n.metadata.type === "CASE" ? n.metadata.caseNumber : n.id,
        arrestDate: n.metadata.type === "CASE" ? n.metadata.arrestDate : null,
      }))
      .sort((a, b) => a.caseNumber.localeCompare(b.caseNumber, "th"));
    out.push({
      id: `same-day:${dateOnly}`,
      type: "SAME_DAY_CASES",
      titleKey: "di.network.insightSameDayCases",
      entityId: null,
      entityType: null,
      entityLabel: null,
      factText: `คดีที่เกี่ยวข้อง ${cases.length} คดีมีวันจับกุมตรงกัน`,
      cases,
      reasonKey: "di.network.insightReasonSameDayCases",
      graphFocus: {
        nodeIds: nodes.map((n) => n.id),
        edgeIds: [],
        primaryNodeId: nodes[0]?.id ?? null,
      },
      metric: cases.length,
    });
  }
  return out;
}

/**
 * Semantic dedup key: (entity identity) + (sorted, deduped supporting case
 * ids). Two insights that resolve to the identical tuple communicate the
 * SAME operational fact and must not both be shown — never compares
 * rendered Thai strings/labels, only canonical entityId + real case ids.
 * Case ordering never affects the key (sorted before joining).
 */
function factualKey(entityId: string | null, caseIds: readonly string[]): string | null {
  if (!entityId) return null;
  const distinctSorted = [...new Set(caseIds)].sort();
  return `${entityId}|${distinctSorted.join(",")}`;
}

/**
 * Semantic deduplication (visual-review hotfix): CROSS_CASE_ENTITY and
 * COMMON_EVIDENCE can independently derive the identical (entity, case-set)
 * fact from the same edges — e.g. a phone appearing in the same 3 cases
 * produces both "เบอร์โทรศัพท์นี้ปรากฏในหลายคดี" and "พบข้อมูลรายการเดียวกัน...",
 * which is the same fact told twice. When both types resolve to the exact
 * same factual tuple, only the more specific CROSS_CASE_ENTITY observation
 * is kept — COMMON_EVIDENCE is only dropped for THAT specific duplicate
 * tuple, never disabled as a type. An entity with no CROSS_CASE_ENTITY
 * counterpart (not one of the 5 PERSON/PHONE/SIM/DEVICE/VEHICLE cross-case
 * types, or genuinely a different case set) keeps its COMMON_EVIDENCE card.
 * SHARED_CONNECTION and SAME_DAY_CASES are never deduplicated against
 * anything — they represent distinct relationship/temporal facts even when
 * their case sets overlap with a cross-case/common-evidence observation.
 */
function dedupeInsights(insights: readonly NetworkGraphInsight[]): NetworkGraphInsight[] {
  const crossCaseKeys = new Set<string>();
  for (const insight of insights) {
    if (insight.type !== "CROSS_CASE_ENTITY") continue;
    const key = factualKey(insight.entityId, insight.cases.map((c) => c.caseId));
    if (key) crossCaseKeys.add(key);
  }
  return insights.filter((insight) => {
    if (insight.type !== "COMMON_EVIDENCE") return true;
    const key = factualKey(insight.entityId, insight.cases.map((c) => c.caseId));
    if (!key) return true;
    return !crossCaseKeys.has(key);
  });
}

/**
 * Builds every V1 insight type for the given loaded neighborhood, sorted by
 * the transparent metric only (distinct case count desc), then a stable
 * insight-type priority, then stable label/id ordering — never a risk/
 * importance ranking (Section 19). Semantically-duplicate COMMON_EVIDENCE
 * observations are removed before sorting/capping (see dedupeInsights).
 * Capped at INSIGHT_MAX_TOTAL.
 */
export function computeNetworkGraphInsights(
  neighborhood: DrugGraphNeighborhoodResponse,
): NetworkGraphInsight[] {
  const byId = nodeById(neighborhood.nodes);
  const all = dedupeInsights([
    ...computeCrossCaseEntityInsights(neighborhood, byId),
    ...computeSharedConnectionInsights(neighborhood, byId),
    ...computeCommonEvidenceInsights(neighborhood, byId),
    ...computeSameDayInsights(neighborhood),
  ]);

  const typePriority: Record<NetworkGraphInsightType, number> = {
    CROSS_CASE_ENTITY: 0,
    SHARED_CONNECTION: 1,
    COMMON_EVIDENCE: 2,
    SAME_DAY_CASES: 3,
  };

  all.sort((a, b) => {
    if (b.metric !== a.metric) return b.metric - a.metric;
    if (typePriority[a.type] !== typePriority[b.type]) return typePriority[a.type] - typePriority[b.type];
    const aLabel = a.entityLabel ?? a.id;
    const bLabel = b.entityLabel ?? b.id;
    return aLabel.localeCompare(bLabel, "th");
  });

  return all.slice(0, INSIGHT_MAX_TOTAL);
}

/** Filters the full insight set to those concerning ONE selected entity — for the Inspector's per-node panel. Includes SAME_DAY_CASES insights whose case set includes the selected node when the selected node is itself a CASE. */
export function insightsForEntity(
  insights: readonly NetworkGraphInsight[],
  entityId: string,
): NetworkGraphInsight[] {
  return insights.filter((insight) => {
    if (insight.entityId === entityId) return true;
    if (insight.graphFocus.nodeIds.includes(entityId)) return true;
    return false;
  });
}
