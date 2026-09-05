import type { DrugInvestigationBoardWorkspaceSnapshot } from "@/lib/drug_intelligence/drug_investigation_board_state";
import type { DrugGraphEdge, DrugGraphNode } from "@/lib/drug_intelligence/drug_network_graph_types";

export function sampleWorkspaceSnapshot(): DrugInvestigationBoardWorkspaceSnapshot {
  return {
    graphContext: {
      focusType: "PERSON",
      focusId: "person-a",
      depth: 2,
      maxNodes: 50,
      nodeTypes: ["PERSON", "CASE", "PHONE"],
      relationshipTypes: ["PERSON_CASE", "SHARED_CASE"],
    },
    presentation: {
      layoutMode: "PERSON_CENTERED",
      labelMode: "ALL",
      nodeDensity: "STANDARD",
      boardLocked: true,
      viewport: { x: 12, y: -40, zoom: 1.25 },
    },
    nodes: [
      { id: "person-a", type: "PERSON", position: { x: 100, y: 80 }, pinned: true },
      { id: "person-b", type: "PERSON", position: { x: 280, y: 80 } },
      { id: "case-1", type: "CASE", position: { x: 190, y: 220 } },
    ],
    pinnedNodeIds: ["person-a"],
    edgeRoutes: {
      "pc:link-1": {
        mode: "CURVED",
        waypoints: [
          { id: "wp-1", x: 140, y: 140 },
          { id: "wp-2", x: 160, y: 180 },
        ],
      },
      "inf:SHARED_CASE:person-a:person-b": {
        mode: "STRAIGHT",
        waypoints: [{ id: "wp-3", x: 190, y: 90 }],
      },
    },
    annotations: [
      {
        id: "ann-rect-1",
        type: "RECTANGLE",
        color: "#3b82f6",
        fillColor: "#eff6ff",
        strokeWidth: 2,
        strokeDash: "solid",
        position: { x: 20, y: 20 },
        width: 200,
        height: 120,
      },
      {
        id: "ann-ell-1",
        type: "ELLIPSE",
        color: "#22c55e",
        fillColor: "transparent",
        strokeWidth: 2,
        position: { x: 40, y: 160 },
        width: 160,
        height: 100,
      },
      {
        id: "ann-text-1",
        type: "TEXT",
        color: "#111827",
        fillColor: "transparent",
        strokeWidth: 0,
        text: "อาจเป็นผู้ประสาน",
        fontSize: 16,
        position: { x: 60, y: 300 },
        width: 180,
        height: 60,
      },
      {
        id: "ann-line-1",
        type: "LINE",
        color: "#666666",
        fillColor: "transparent",
        strokeWidth: 2,
        strokeDash: "dashed",
        endOffset: { x: 80, y: 40 },
        position: { x: 300, y: 40 },
      },
      {
        id: "ann-arrow-1",
        type: "ARROW",
        color: "#ef4444",
        fillColor: "transparent",
        strokeWidth: 2,
        endOffset: { x: 60, y: -20 },
        position: { x: 320, y: 200 },
      },
    ],
  };
}

export function sampleLiveGraph(overrides?: { dropDirect?: boolean; dropInferred?: boolean; missingPersonB?: boolean; relabel?: boolean; maskPhone?: boolean; mergePersonA?: boolean }): {
  nodes: DrugGraphNode[];
  edges: DrugGraphEdge[];
} {
  const personA: DrugGraphNode = {
    id: "person-a",
    type: "PERSON",
    label: overrides?.relabel ? "นาย ก (อัปเดต)" : "นาย ก",
    secondaryLabel: null,
    maskedLabel: null,
    metadata: overrides?.mergePersonA
      ? { type: "PERSON", status: "MERGED", canonicalTarget: { entityId: "person-survivor", primaryLabel: "นาย ก" }, hasPotentialDuplicate: false }
      : { type: "PERSON", status: "ACTIVE", canonicalTarget: null, hasPotentialDuplicate: false },
    firstSeenAt: null,
    lastSeenAt: null,
    caseCount: 1,
    riskIndicators: [],
  };
  const personSurvivor: DrugGraphNode = {
    id: "person-survivor",
    type: "PERSON",
    label: "นาย ก",
    secondaryLabel: null,
    maskedLabel: null,
    metadata: { type: "PERSON", status: "ACTIVE", canonicalTarget: null, hasPotentialDuplicate: false },
    firstSeenAt: null,
    lastSeenAt: null,
    caseCount: 1,
    riskIndicators: [],
  };
  const personB: DrugGraphNode = {
    id: "person-b",
    type: "PERSON",
    label: "นาย ข",
    secondaryLabel: null,
    maskedLabel: null,
    metadata: { type: "PERSON", status: "ACTIVE", canonicalTarget: null, hasPotentialDuplicate: false },
    firstSeenAt: null,
    lastSeenAt: null,
    caseCount: 1,
    riskIndicators: [],
  };
  const caseNode: DrugGraphNode = {
    id: "case-1",
    type: "CASE",
    label: "คดี-001",
    secondaryLabel: null,
    maskedLabel: null,
    metadata: { type: "CASE", caseNumber: "คดี-001", status: "OPEN", arrestDate: null, province: "ชุมพร", reportingUnitText: null },
    firstSeenAt: null,
    lastSeenAt: null,
    caseCount: 1,
    riskIndicators: [],
  };
  const phone: DrugGraphNode = {
    id: "phone-1",
    type: "PHONE",
    label: overrides?.maskPhone ? "08x-xxx-1234" : "0812345678",
    secondaryLabel: null,
    maskedLabel: "08x-xxx-1234",
    metadata: { type: "PHONE", carrier: null },
    firstSeenAt: null,
    lastSeenAt: null,
    caseCount: 1,
    riskIndicators: [],
  };

  const nodes = [personA, caseNode, phone];
  if (!overrides?.missingPersonB) nodes.push(personB);
  if (overrides?.mergePersonA) nodes.push(personSurvivor);

  const edges: DrugGraphEdge[] = [];
  if (!overrides?.dropDirect) {
    edges.push({
      id: "pc:link-1",
      source: "person-a",
      target: "case-1",
      relationshipType: "PERSON_CASE",
      edgeKind: "DIRECT",
      evidenceCount: 1,
      firstSeenAt: null,
      lastSeenAt: null,
      sourceCaseIds: ["case-1"],
      explanation: { kind: "DIRECT_ROLE", role: "SUSPECT" },
    });
  }
  if (!overrides?.dropInferred && !overrides?.missingPersonB) {
    edges.push({
      id: "inf:SHARED_CASE:person-a:person-b",
      source: "person-a",
      target: "person-b",
      relationshipType: "SHARED_CASE",
      edgeKind: "INFERRED",
      evidenceCount: 1,
      firstSeenAt: null,
      lastSeenAt: null,
      sourceCaseIds: ["case-1"],
      explanation: { kind: "SHARED_CASES", count: 1 },
    });
  }
  return { nodes, edges };
}
