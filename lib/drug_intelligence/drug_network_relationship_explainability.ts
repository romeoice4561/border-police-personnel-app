/**
 * DI-9.5 / DI-9.5.1 — relationship explainability for the Network graph.
 *
 * Composes a field-officer investigation story from facts already present on
 * the loaded neighborhood (nodes, edges, caseCount, sourceCaseIds, CASE
 * metadata). Never invents ownership, communication, guilt, presence, risk, or
 * confidence. Never issues I/O — shared entities and repeated-entity signals
 * are derived from DIRECT edges already in the graph response.
 */

import { formatDiDate } from "@/lib/drug_intelligence/di_date_helpers";
import { DRUG_CASE_PERSON_ROLE_LABELS, isValidDrugCasePersonRole } from "@/lib/drug_intelligence/drug_person_options";
import { drugEntityDetailPath } from "@/lib/drug_intelligence/drug_entity_routes";
import type {
  DrugGraphEdge,
  DrugGraphNeighborhoodResponse,
  DrugGraphNode,
  DrugGraphNodeType,
} from "@/lib/drug_intelligence/drug_intelligence_client";

const SHARED_ENTITY_TYPES = new Set<DrugGraphNodeType>(["PHONE", "SIM", "DEVICE", "VEHICLE"]);
const CASE_LINK_RELATIONSHIP_TYPES = new Set([
  "CASE_PHONE",
  "CASE_SIM",
  "CASE_DEVICE",
  "CASE_VEHICLE",
  "CASE_LOCATION",
  "PERSON_CASE",
]);

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MISSING_DATE_TH = "ไม่มีข้อมูล";

const ENTITY_STORY_META: Record<
  "PHONE" | "SIM" | "DEVICE" | "VEHICLE",
  { emoji: string; chipTh: string; chipEn: string; nounTh: string; nounEn: string; openTh: string; openEn: string; openAllTh: string; openAllEn: string }
> = {
  PHONE: {
    emoji: "📞",
    chipTh: "เบอร์โทร",
    chipEn: "phones",
    nounTh: "เบอร์โทรศัพท์",
    nounEn: "Phone number",
    openTh: "เปิดข้อมูลเบอร์",
    openEn: "Open phone record",
    openAllTh: "เปิดข้อมูลเบอร์เพื่อดูคดีทั้งหมด",
    openAllEn: "Open the phone record to see all cases",
  },
  SIM: {
    emoji: "💳",
    chipTh: "SIM",
    chipEn: "SIMs",
    nounTh: "SIM",
    nounEn: "SIM",
    openTh: "เปิดข้อมูล SIM",
    openEn: "Open SIM record",
    openAllTh: "เปิดข้อมูล SIM เพื่อดูคดีทั้งหมด",
    openAllEn: "Open the SIM record to see all cases",
  },
  DEVICE: {
    emoji: "📱",
    chipTh: "อุปกรณ์",
    chipEn: "devices",
    nounTh: "อุปกรณ์",
    nounEn: "Device",
    openTh: "เปิดข้อมูลอุปกรณ์",
    openEn: "Open device record",
    openAllTh: "เปิดข้อมูลอุปกรณ์เพื่อดูคดีทั้งหมด",
    openAllEn: "Open the device record to see all cases",
  },
  VEHICLE: {
    emoji: "🚗",
    chipTh: "ยานพาหนะ",
    chipEn: "vehicles",
    nounTh: "ยานพาหนะ",
    nounEn: "Vehicle",
    openTh: "เปิดข้อมูลยานพาหนะ",
    openEn: "Open vehicle record",
    openAllTh: "เปิดข้อมูลยานพาหนะเพื่อดูคดีทั้งหมด",
    openAllEn: "Open the vehicle record to see all cases",
  },
};

export interface RelationshipSharedEntity {
  id: string;
  type: DrugGraphNodeType;
  label: string;
  caseCount: number;
  foundInThisCase: boolean;
}

export interface RelationshipCaseRef {
  id: string;
  label: string | null;
}

export interface RelationshipSummaryChip {
  type: "PHONE" | "SIM" | "DEVICE" | "VEHICLE";
  emoji: string;
  label: string;
  count: number;
}

export interface RelationshipCrossCaseSignal {
  id: string;
  type: DrugGraphNodeType;
  emoji: string;
  typeLabel: string;
  label: string;
  caseCount: number;
  currentCaseLabel: string | null;
  otherCaseLabels: string[];
  neighborhoodIncomplete: boolean;
  story: string;
  totalLine: string;
  openAllHint: string | null;
  openLabel: string;
}

export interface RelationshipOtherInCaseRow {
  id: string;
  type: DrugGraphNodeType;
  emoji: string;
  label: string;
  caseCount: number;
  foundLine: string;
  openLabel: string;
}

export interface RelationshipInvestigationAction {
  kind: "FOCUS" | "OPEN";
  prominence: "primary" | "secondary";
  entityType: DrugGraphNodeType;
  entityId: string;
  label: string;
}

export interface RelationshipExplanationModel {
  classification: "DIRECT" | "INFERRED";
  whyHeadingKind: "CONNECTED" | "INFERRED_PERSONS";
  sourceLabel: string | null;
  targetLabel: string | null;
  sentence: string;
  followUpSentence: string | null;
  insufficientDetail: boolean;
  inferredDisclaimer: string | null;
  inferredFacts: string[];
  roleLabel: string | null;
  caseNumber: string | null;
  arrestDate: string | null;
  province: string | null;
  reportingUnitText: string | null;
  compactCaseContext: string | null;
  provenanceCases: RelationshipCaseRef[];
  showSeparateProvenance: boolean;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  sharedEntities: RelationshipSharedEntity[];
  sharedInCurrentCase: boolean;
  summaryChips: RelationshipSummaryChip[];
  crossCaseSignals: RelationshipCrossCaseSignal[];
  otherInCase: RelationshipOtherInCaseRow[];
  recurrence: { label: string; caseCount: number; entityType: DrugGraphNodeType; entityId: string } | null;
  actions: RelationshipInvestigationAction[];
  openCaseId: string | null;
  openPersonId: string | null;
  openEntity: { type: DrugGraphNodeType; id: string } | null;
  focusPerson: DrugGraphNode | null;
  focusCase: DrugGraphNode | null;
}

export function findConnectingEdge(edges: DrugGraphEdge[], a: string, b: string): DrugGraphEdge | null {
  const matches = edges.filter(
    (edge) => (edge.source === a && edge.target === b) || (edge.source === b && edge.target === a)
  );
  if (matches.length === 0) return null;
  return matches.find((edge) => edge.edgeKind === "DIRECT") ?? matches[0]!;
}

export function connectingEdgeForExplanationClick(args: {
  clickedId: string;
  focusId: string | null;
  selectedNodeId: string | null;
  selectedEdge: { source: string; target: string } | null;
  edges: DrugGraphEdge[];
}): DrugGraphEdge | null {
  const counterparts: string[] = [];
  if (args.selectedEdge) {
    counterparts.push(args.selectedEdge.source, args.selectedEdge.target);
  }
  if (args.selectedNodeId && args.selectedNodeId !== args.clickedId) {
    counterparts.push(args.selectedNodeId);
  }
  if (args.focusId && args.focusId !== args.clickedId) {
    counterparts.push(args.focusId);
  }
  const seen = new Set<string>();
  for (const other of counterparts) {
    if (seen.has(other) || other === args.clickedId) continue;
    seen.add(other);
    const edge = findConnectingEdge(args.edges, other, args.clickedId);
    if (edge) return edge;
  }
  return null;
}

export function neighborsViaDirectEdge(nodeId: string, edges: DrugGraphEdge[]): Map<string, DrugGraphEdge[]> {
  const map = new Map<string, DrugGraphEdge[]>();
  for (const edge of edges) {
    if (edge.edgeKind !== "DIRECT") continue;
    let other: string | null = null;
    if (edge.source === nodeId) other = edge.target;
    else if (edge.target === nodeId) other = edge.source;
    if (!other) continue;
    const list = map.get(other) ?? [];
    list.push(edge);
    map.set(other, list);
  }
  return map;
}

export function sharedEntitiesBetween(
  neighborhood: Pick<DrugGraphNeighborhoodResponse, "nodes" | "edges">,
  aId: string,
  bId: string
): DrugGraphNode[] {
  const aNeighbors = neighborsViaDirectEdge(aId, neighborhood.edges);
  const bNeighbors = neighborsViaDirectEdge(bId, neighborhood.edges);
  const nodesById = new Map(neighborhood.nodes.map((node) => [node.id, node]));
  const shared: DrugGraphNode[] = [];
  const seen = new Set<string>();
  for (const [id] of aNeighbors) {
    if (id === aId || id === bId) continue;
    if (!bNeighbors.has(id)) continue;
    if (seen.has(id)) continue;
    const node = nodesById.get(id);
    if (!node || !SHARED_ENTITY_TYPES.has(node.type)) continue;
    seen.add(id);
    shared.push(node);
  }
  return shared;
}

export function sharedCaseNodesBetween(
  neighborhood: Pick<DrugGraphNeighborhoodResponse, "nodes" | "edges">,
  aId: string,
  bId: string
): DrugGraphNode[] {
  const aNeighbors = neighborsViaDirectEdge(aId, neighborhood.edges);
  const bNeighbors = neighborsViaDirectEdge(bId, neighborhood.edges);
  const nodesById = new Map(neighborhood.nodes.map((node) => [node.id, node]));
  const shared: DrugGraphNode[] = [];
  const seen = new Set<string>();
  for (const [id] of aNeighbors) {
    if (id === aId || id === bId) continue;
    if (!bNeighbors.has(id)) continue;
    if (seen.has(id)) continue;
    const node = nodesById.get(id);
    if (!node || node.type !== "CASE") continue;
    seen.add(id);
    shared.push(node);
  }
  return shared;
}

export function caseDisplayLabel(node: DrugGraphNode | null | undefined): string | null {
  if (!node || node.type !== "CASE") return null;
  const fromLabel = safeDisplayLabel(node.label);
  if (fromLabel) return fromLabel;
  if (node.metadata.type === "CASE") return safeDisplayLabel(node.metadata.caseNumber);
  return null;
}

export function safeDisplayLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (UUID_LIKE.test(trimmed)) return null;
  return trimmed;
}

function nodeById(nodes: DrugGraphNode[], id: string): DrugGraphNode | null {
  return nodes.find((node) => node.id === id) ?? null;
}

function pickNodeOfType(a: DrugGraphNode | null, b: DrugGraphNode | null, type: DrugGraphNodeType): DrugGraphNode | null {
  if (a?.type === type) return a;
  if (b?.type === type) return b;
  return null;
}

function otherEndpointId(edge: DrugGraphEdge, nodeId: string): string | null {
  if (edge.source === nodeId) return edge.target;
  if (edge.target === nodeId) return edge.source;
  return null;
}

function provenanceCases(edge: DrugGraphEdge, nodes: DrugGraphNode[]): RelationshipCaseRef[] {
  const seen = new Set<string>();
  const refs: RelationshipCaseRef[] = [];
  for (const id of edge.sourceCaseIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const caseNode = nodeById(nodes, id);
    refs.push({ id, label: caseDisplayLabel(caseNode) });
  }
  return refs;
}

function roleLabelFor(edge: DrugGraphEdge, language: "th" | "en"): string | null {
  if (edge.explanation.kind !== "DIRECT_ROLE") return null;
  if (!isValidDrugCasePersonRole(edge.explanation.role)) return edge.explanation.role;
  const meta = DRUG_CASE_PERSON_ROLE_LABELS[edge.explanation.role];
  return language === "th" ? meta.labelTh : meta.labelEn;
}

export function compactCaseContextLine(args: {
  arrestDate: string | null;
  province: string | null;
  reportingUnitText: string | null;
}): string | null {
  const parts: string[] = [];
  if (args.arrestDate) {
    const formatted = formatDiDate(args.arrestDate);
    if (formatted && formatted !== MISSING_DATE_TH) parts.push(formatted);
  }
  if (args.province?.trim()) parts.push(args.province.trim());
  if (args.reportingUnitText?.trim()) parts.push(args.reportingUnitText.trim());
  return parts.length > 0 ? parts.join(" • ") : null;
}

export function otherCaseLabelsForEntity(
  neighborhood: Pick<DrugGraphNeighborhoodResponse, "nodes" | "edges">,
  entityId: string,
  currentCaseId: string | null
): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const edge of neighborhood.edges) {
    if (edge.edgeKind !== "DIRECT") continue;
    const otherId = otherEndpointId(edge, entityId);
    if (!otherId || otherId === currentCaseId) continue;
    const other = nodeById(neighborhood.nodes, otherId);
    if (!other || other.type !== "CASE") continue;
    const label = caseDisplayLabel(other);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  labels.sort((a, b) => a.localeCompare(b, "th"));
  return labels;
}

function entityStoryMeta(type: DrugGraphNodeType) {
  if (type === "PHONE" || type === "SIM" || type === "DEVICE" || type === "VEHICLE") {
    return ENTITY_STORY_META[type];
  }
  return null;
}

export function sortCrossCaseSignals<T extends { caseCount: number; label: string; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (b.caseCount !== a.caseCount) return b.caseCount - a.caseCount;
    const labelCmp = a.label.localeCompare(b.label, "th");
    if (labelCmp !== 0) return labelCmp;
    return a.id.localeCompare(b.id);
  });
}

function buildCrossCaseSignal(
  node: DrugGraphNode,
  currentCaseLabel: string | null,
  currentCaseId: string | null,
  neighborhood: Pick<DrugGraphNeighborhoodResponse, "nodes" | "edges">,
  language: "th" | "en",
  listMode: "other-cases" | "all-cases"
): RelationshipCrossCaseSignal | null {
  if (node.caseCount <= 1) return null;
  const meta = entityStoryMeta(node.type);
  if (!meta) return null;
  const label = safeDisplayLabel(node.label) ?? node.label;
  const excludeId = listMode === "other-cases" ? currentCaseId : null;
  const otherCaseLabels = otherCaseLabelsForEntity(neighborhood, node.id, excludeId);
  const expectedListed = listMode === "all-cases" ? node.caseCount : Math.max(0, node.caseCount - 1);
  const neighborhoodIncomplete = otherCaseLabels.length < expectedListed;
  const currentPhrase = currentCaseLabel ?? (language === "th" ? "คดีนี้" : "this case");
  const expectedOther = Math.max(0, node.caseCount - 1);
  const story =
    language === "th"
      ? `พบใน ${currentPhrase} และพบซ้ำในอีก ${expectedOther} คดี`
      : `Found in ${currentPhrase} and repeated in ${expectedOther} other case(s)`;
  return {
    id: node.id,
    type: node.type,
    emoji: meta.emoji,
    typeLabel: language === "th" ? meta.nounTh : meta.nounEn,
    label,
    caseCount: node.caseCount,
    currentCaseLabel,
    otherCaseLabels,
    neighborhoodIncomplete,
    story,
    totalLine: language === "th" ? `พบรวม ${node.caseCount} คดี` : `Found in ${node.caseCount} cases total`,
    openAllHint: neighborhoodIncomplete ? (language === "th" ? meta.openAllTh : meta.openAllEn) : null,
    openLabel: language === "th" ? meta.openTh : meta.openEn,
  };
}

function buildOtherInCaseRow(node: DrugGraphNode, language: "th" | "en"): RelationshipOtherInCaseRow | null {
  const meta = entityStoryMeta(node.type);
  if (!meta) return null;
  return {
    id: node.id,
    type: node.type,
    emoji: meta.emoji,
    label: safeDisplayLabel(node.label) ?? node.label,
    caseCount: node.caseCount,
    foundLine: language === "th" ? `พบ ${node.caseCount} คดี` : `Found in ${node.caseCount} case(s)`,
    openLabel: language === "th" ? "ดูข้อมูล" : "View record",
  };
}

function summaryChipsFromNodes(nodes: DrugGraphNode[], language: "th" | "en"): RelationshipSummaryChip[] {
  const counts: Record<"PHONE" | "SIM" | "DEVICE" | "VEHICLE", number> = {
    PHONE: 0,
    SIM: 0,
    DEVICE: 0,
    VEHICLE: 0,
  };
  for (const node of nodes) {
    if (node.type === "PHONE" || node.type === "SIM" || node.type === "DEVICE" || node.type === "VEHICLE") {
      counts[node.type] += 1;
    }
  }
  const order: Array<"PHONE" | "SIM" | "DEVICE" | "VEHICLE"> = ["PHONE", "SIM", "DEVICE", "VEHICLE"];
  return order
    .filter((type) => counts[type] > 0)
    .map((type) => ({
      type,
      emoji: ENTITY_STORY_META[type].emoji,
      label: language === "th" ? ENTITY_STORY_META[type].chipTh : ENTITY_STORY_META[type].chipEn,
      count: counts[type],
    }));
}

function inferredFactsFromLoadedGraph(
  neighborhood: Pick<DrugGraphNeighborhoodResponse, "nodes" | "edges">,
  aId: string,
  bId: string,
  language: "th" | "en"
): string[] {
  const facts: string[] = [];
  if (sharedCaseNodesBetween(neighborhood, aId, bId).length > 0) {
    facts.push(language === "th" ? "พบในคดีเดียวกัน" : "Found on the same case");
  }
  const shared = sharedEntitiesBetween(neighborhood, aId, bId);
  if (shared.some((node) => node.type === "PHONE")) {
    facts.push(language === "th" ? "ใช้หมายเลขที่เชื่อมโยงร่วมกัน" : "Linked through the same phone number");
  }
  if (shared.some((node) => node.type === "SIM" || node.type === "DEVICE" || node.type === "VEHICLE")) {
    facts.push(
      language === "th" ? "มี SIM/DEVICE/VEHICLE ที่พบร่วมกัน" : "Linked through the same SIM, device, or vehicle"
    );
  }
  return facts;
}

function composeSentence(args: {
  edge: DrugGraphEdge;
  source: DrugGraphNode | null;
  target: DrugGraphNode | null;
  language: "th" | "en";
  roleLabel: string | null;
}): { sentence: string; followUpSentence: string | null; insufficientDetail: boolean } {
  const { edge, language, roleLabel } = args;
  const caseNode = pickNodeOfType(args.source, args.target, "CASE");
  const personNode = pickNodeOfType(args.source, args.target, "PERSON");
  const phoneNode = pickNodeOfType(args.source, args.target, "PHONE");
  const caseLabel = caseDisplayLabel(caseNode);
  const casePhrase = caseLabel ?? (language === "th" ? "คดีนี้" : "this case");
  const personLabel = safeDisplayLabel(personNode?.label ?? null);
  const phoneLabel = safeDisplayLabel(phoneNode?.label ?? null);

  switch (edge.relationshipType) {
    case "PERSON_CASE": {
      if (roleLabel) {
        const who = personLabel ?? (language === "th" ? "บุคคลนี้" : "This person");
        return {
          sentence:
            language === "th"
              ? `${who} ถูกบันทึกเป็น${roleLabel}ในคดี ${casePhrase}`
              : `${who} is recorded as ${roleLabel} on case ${casePhrase}`,
          followUpSentence: null,
          insufficientDetail: false,
        };
      }
      return {
        sentence:
          language === "th"
            ? `บุคคลนี้ถูกบันทึกอยู่ในคดี ${casePhrase}`
            : `This person is recorded on case ${casePhrase}`,
        followUpSentence: null,
        insufficientDetail: false,
      };
    }
    case "CASE_PHONE": {
      const numberPhrase = phoneLabel ? `หมายเลข ${phoneLabel}` : language === "th" ? "หมายเลขโทรศัพท์นี้" : "This phone number";
      const enNumber = phoneLabel ? `Number ${phoneLabel}` : "This phone number";
      return {
        sentence:
          language === "th"
            ? `${numberPhrase} ถูกบันทึกอยู่ในคดี ${casePhrase}`
            : `${enNumber} is recorded on case ${casePhrase}`,
        followUpSentence:
          phoneNode && phoneNode.caseCount > 1
            ? language === "th"
              ? `หมายเลขเดียวกันพบรวม ${phoneNode.caseCount} คดี`
              : `The same number is found in ${phoneNode.caseCount} cases total`
            : null,
        insufficientDetail: false,
      };
    }
    case "CASE_SIM":
      return {
        sentence: language === "th" ? `SIM นี้ถูกบันทึกในคดี ${casePhrase}` : `This SIM is recorded on case ${casePhrase}`,
        followUpSentence: null,
        insufficientDetail: false,
      };
    case "CASE_DEVICE":
      return {
        sentence: language === "th" ? `อุปกรณ์นี้ถูกบันทึกในคดี ${casePhrase}` : `This device is recorded on case ${casePhrase}`,
        followUpSentence: null,
        insufficientDetail: false,
      };
    case "CASE_VEHICLE":
      return {
        sentence:
          language === "th" ? `ยานพาหนะนี้ถูกบันทึกในคดี ${casePhrase}` : `This vehicle is recorded on case ${casePhrase}`,
        followUpSentence: null,
        insufficientDetail: false,
      };
    case "CASE_LOCATION":
      return {
        sentence:
          language === "th" ? `สถานที่นี้ถูกบันทึกอยู่ในคดี ${casePhrase}` : `This location is recorded on case ${casePhrase}`,
        followUpSentence: null,
        insufficientDetail: false,
      };
    case "PERSON_PHONE": {
      const numberPhrase = phoneLabel ? `หมายเลข ${phoneLabel}` : language === "th" ? "หมายเลขโทรศัพท์นี้" : "This phone number";
      const who = personLabel ?? (language === "th" ? "บุคคลนี้" : "this person");
      return {
        sentence:
          language === "th"
            ? `${numberPhrase} พบเชื่อมโยงกับ${who}จากข้อมูลคดี`
            : `${phoneLabel ? `Number ${phoneLabel}` : "This phone number"} is linked to ${who} from case records`,
        followUpSentence:
          phoneNode && phoneNode.caseCount > 1
            ? language === "th"
              ? `พบหมายเลขนี้รวม ${phoneNode.caseCount} คดี`
              : `This number is found in ${phoneNode.caseCount} cases total`
            : null,
        insufficientDetail: false,
      };
    }
    case "PERSON_SIM":
      return {
        sentence:
          language === "th"
            ? "SIM ที่พบเชื่อมโยงกับบุคคลนี้จากข้อมูลคดี"
            : "SIM linked to this person from case records",
        followUpSentence: null,
        insufficientDetail: false,
      };
    case "PERSON_DEVICE":
      if (edge.sourceCaseIds.length > 0) {
        return {
          sentence:
            language === "th"
              ? `อุปกรณ์นี้ถูกบันทึกในคดี${caseLabel ? ` ${caseLabel}` : "ที่เกี่ยวข้อง"}`
              : `This device is recorded on ${caseLabel ? `case ${caseLabel}` : "a related case"}`,
          followUpSentence: null,
          insufficientDetail: false,
        };
      }
      return {
        sentence:
          language === "th"
            ? "ข้อมูลที่เกี่ยวข้อง แต่ยังระบุคดีที่พบไม่ได้"
            : "Related record, but the case where it was found is not specified",
        followUpSentence: null,
        insufficientDetail: false,
      };
    case "PERSON_VEHICLE":
      if (edge.sourceCaseIds.length > 0) {
        return {
          sentence:
            language === "th"
              ? `ยานพาหนะนี้ถูกบันทึกในคดี${caseLabel ? ` ${caseLabel}` : "ที่เกี่ยวข้อง"}`
              : `This vehicle is recorded on ${caseLabel ? `case ${caseLabel}` : "a related case"}`,
          followUpSentence: null,
          insufficientDetail: false,
        };
      }
      return {
        sentence:
          language === "th"
            ? "ข้อมูลที่เกี่ยวข้อง แต่ยังระบุคดีที่พบไม่ได้"
            : "Related record, but the case where it was found is not specified",
        followUpSentence: null,
        insufficientDetail: false,
      };
    case "SHARED_CASE":
    case "SHARED_PHONE":
    case "SHARED_SIM":
    case "SHARED_DEVICE":
    case "SHARED_VEHICLE":
      return {
        sentence:
          language === "th"
            ? "ระบบพบว่าบุคคลทั้งสองมีข้อมูลร่วมกัน"
            : "The system found that both persons share recorded data",
        followUpSentence: null,
        insufficientDetail: false,
      };
  }
}

function entityLinkedToCase(entityId: string, caseId: string, edges: DrugGraphEdge[]): boolean {
  return edges.some((edge) => {
    if (edge.edgeKind !== "DIRECT") return false;
    const touches =
      (edge.source === entityId && edge.target === caseId) || (edge.target === entityId && edge.source === caseId);
    if (!touches) return false;
    return CASE_LINK_RELATIONSHIP_TYPES.has(edge.relationshipType);
  });
}

function mentionedLabels(args: {
  sentence: string;
  followUpSentence: string | null;
  currentCaseLabel: string | null;
  signals: RelationshipCrossCaseSignal[];
}): Set<string> {
  const mentioned = new Set<string>();
  if (args.currentCaseLabel) mentioned.add(args.currentCaseLabel);
  for (const signal of args.signals) {
    for (const label of signal.otherCaseLabels) mentioned.add(label);
    if (signal.currentCaseLabel) mentioned.add(signal.currentCaseLabel);
  }
  const haystack = `${args.sentence} ${args.followUpSentence ?? ""}`;
  for (const label of mentioned) {
    if (!haystack.includes(label) && !args.signals.some((signal) => signal.otherCaseLabels.includes(label))) {
      mentioned.delete(label);
    }
  }
  if (args.currentCaseLabel && haystack.includes(args.currentCaseLabel)) mentioned.add(args.currentCaseLabel);
  for (const signal of args.signals) {
    for (const label of signal.otherCaseLabels) mentioned.add(label);
  }
  return mentioned;
}

function focusPersonActionLabel(personLabel: string | null, language: "th" | "en"): string {
  if (personLabel) return language === "th" ? `โฟกัสที่${personLabel}` : `Focus on ${personLabel}`;
  return language === "th" ? "โฟกัสที่บุคคลนี้" : "Focus on this person";
}

export function investigationActionsForRelationship(args: {
  edge: DrugGraphEdge;
  language: "th" | "en";
  focusId: string | null | undefined;
  sourceNode: DrugGraphNode | null;
  targetNode: DrugGraphNode | null;
  personNode: DrugGraphNode | null;
  caseNode: DrugGraphNode | null;
  entityNode: DrugGraphNode | null;
}): RelationshipInvestigationAction[] {
  const { edge, language, personNode, caseNode, entityNode, sourceNode, targetNode } = args;
  const focusId = args.focusId ?? null;
  const personLabel = safeDisplayLabel(personNode?.label ?? null);
  const caseLabel = caseDisplayLabel(caseNode);
  const entityMeta = entityNode ? entityStoryMeta(entityNode.type) : null;
  const openProfile = language === "th" ? "เปิดโปรไฟล์บุคคล" : "Open person profile";
  const focusPersonLabel = focusPersonActionLabel(personLabel, language);
  const openCaseLabel = caseLabel
    ? language === "th"
      ? `เปิดคดี ${caseLabel}`
      : `Open case ${caseLabel}`
    : language === "th"
      ? "เปิดคดี"
      : "Open case";
  const focusCaseLabel = caseLabel
    ? language === "th"
      ? `โฟกัสที่คดี ${caseLabel}`
      : `Focus on case ${caseLabel}`
    : language === "th"
      ? "โฟกัสที่คดีนี้"
      : "Focus on this case";
  const openEntityLabel = entityMeta ? (language === "th" ? entityMeta.openTh : entityMeta.openEn) : null;
  const actions: RelationshipInvestigationAction[] = [];
  const push = (action: RelationshipInvestigationAction) => {
    if (actions.some((item) => item.kind === action.kind && item.entityId === action.entityId && item.prominence === action.prominence)) return;
    if (actions.some((item) => item.kind === action.kind && item.entityId === action.entityId)) return;
    actions.push(action);
  };

  if (edge.relationshipType === "PERSON_CASE" && personNode && caseNode) {
    if (focusId === personNode.id) {
      push({ kind: "OPEN", prominence: "primary", entityType: "PERSON", entityId: personNode.id, label: openProfile });
      push({ kind: "FOCUS", prominence: "primary", entityType: "CASE", entityId: caseNode.id, label: focusCaseLabel });
      return actions;
    }
    if (focusId === caseNode.id) {
      push({ kind: "FOCUS", prominence: "primary", entityType: "PERSON", entityId: personNode.id, label: focusPersonLabel });
      push({ kind: "OPEN", prominence: "primary", entityType: "CASE", entityId: caseNode.id, label: openCaseLabel });
      push({ kind: "OPEN", prominence: "secondary", entityType: "PERSON", entityId: personNode.id, label: openProfile });
      return actions;
    }
    push({ kind: "FOCUS", prominence: "primary", entityType: "PERSON", entityId: personNode.id, label: focusPersonLabel });
    push({ kind: "OPEN", prominence: "primary", entityType: "CASE", entityId: caseNode.id, label: openCaseLabel });
    push({ kind: "OPEN", prominence: "secondary", entityType: "PERSON", entityId: personNode.id, label: openProfile });
    return actions;
  }

  if (edge.edgeKind === "INFERRED") {
    const persons = [sourceNode, targetNode].filter((node): node is DrugGraphNode => node?.type === "PERSON");
    for (const person of persons) {
      if (focusId === person.id) continue;
      push({
        kind: "FOCUS",
        prominence: "primary",
        entityType: "PERSON",
        entityId: person.id,
        label: focusPersonActionLabel(safeDisplayLabel(person.label), language),
      });
    }
    const profilePerson = persons.find((person) => person.id === focusId) ?? persons[0];
    if (profilePerson) {
      push({
        kind: "OPEN",
        prominence: persons.some((person) => person.id === focusId) ? "primary" : "secondary",
        entityType: "PERSON",
        entityId: profilePerson.id,
        label: openProfile,
      });
    }
    return [...actions.filter((item) => item.prominence === "primary").slice(0, 2), ...actions.filter((item) => item.prominence === "secondary").slice(0, 1)];
  }

  if (personNode && focusId !== personNode.id) {
    push({ kind: "FOCUS", prominence: "primary", entityType: "PERSON", entityId: personNode.id, label: focusPersonLabel });
  }
  if (caseNode && focusId !== caseNode.id) {
    push({ kind: "OPEN", prominence: "primary", entityType: "CASE", entityId: caseNode.id, label: openCaseLabel });
  }
  if (entityNode && openEntityLabel) {
    push({
      kind: "OPEN",
      prominence: "primary",
      entityType: entityNode.type,
      entityId: entityNode.id,
      label: openEntityLabel,
    });
  }
  if (personNode && focusId === personNode.id) {
    push({ kind: "OPEN", prominence: "primary", entityType: "PERSON", entityId: personNode.id, label: openProfile });
  } else if (personNode && !actions.some((item) => item.kind === "OPEN" && item.entityId === personNode.id)) {
    push({ kind: "OPEN", prominence: "secondary", entityType: "PERSON", entityId: personNode.id, label: openProfile });
  }

  return [
    ...actions.filter((item) => item.prominence === "primary").slice(0, 2),
    ...actions.filter((item) => item.prominence === "secondary").slice(0, 1),
  ];
}

export function buildRelationshipExplanation(args: {
  edge: DrugGraphEdge;
  sourceNode: DrugGraphNode | null;
  targetNode: DrugGraphNode | null;
  neighborhood: Pick<DrugGraphNeighborhoodResponse, "nodes" | "edges">;
  language: "th" | "en";
  focusId?: string | null;
}): RelationshipExplanationModel {
  const { edge, sourceNode, targetNode, neighborhood, language } = args;
  const caseNode = pickNodeOfType(sourceNode, targetNode, "CASE");
  const personNode = pickNodeOfType(sourceNode, targetNode, "PERSON");
  const phoneNode = pickNodeOfType(sourceNode, targetNode, "PHONE");
  const simNode = pickNodeOfType(sourceNode, targetNode, "SIM");
  const deviceNode = pickNodeOfType(sourceNode, targetNode, "DEVICE");
  const vehicleNode = pickNodeOfType(sourceNode, targetNode, "VEHICLE");
  const roleLabel = roleLabelFor(edge, language);
  const composed = composeSentence({ edge, source: sourceNode, target: targetNode, language, roleLabel });
  const sharedNodes =
    sourceNode && targetNode ? sharedEntitiesBetween(neighborhood, sourceNode.id, targetNode.id) : [];
  const caseId = caseNode?.id ?? null;
  const sharedEntities: RelationshipSharedEntity[] = sharedNodes.map((node) => ({
    id: node.id,
    type: node.type,
    label: safeDisplayLabel(node.label) ?? node.label,
    caseCount: node.caseCount,
    foundInThisCase: caseId ? entityLinkedToCase(node.id, caseId, neighborhood.edges) : false,
  }));

  const recurrenceNode = phoneNode ?? simNode ?? deviceNode ?? vehicleNode;
  const caseMeta = caseNode?.metadata.type === "CASE" ? caseNode.metadata : null;
  const openEntityNode = phoneNode ?? simNode ?? deviceNode ?? vehicleNode;
  const currentCaseLabel = caseDisplayLabel(caseNode);
  const storyNodes: DrugGraphNode[] =
    edge.relationshipType === "PERSON_CASE"
      ? sharedNodes
      : recurrenceNode
        ? [recurrenceNode]
        : [];
  const listMode = edge.relationshipType === "PERSON_PHONE" ? "all-cases" : "other-cases";
  const crossCaseSignals = sortCrossCaseSignals(
    storyNodes
      .map((node) => buildCrossCaseSignal(node, currentCaseLabel, caseId, neighborhood, language, listMode))
      .filter((item): item is RelationshipCrossCaseSignal => Boolean(item))
  );
  const signalIds = new Set(crossCaseSignals.map((item) => item.id));
  const otherInCase =
    edge.relationshipType === "PERSON_CASE"
      ? storyNodes.filter((node) => !signalIds.has(node.id)).map((node) => buildOtherInCaseRow(node, language)).filter((item): item is RelationshipOtherInCaseRow => Boolean(item))
      : [];
  const inferred = edge.edgeKind === "INFERRED";
  const inferredFacts =
    inferred && sourceNode && targetNode
      ? inferredFactsFromLoadedGraph(neighborhood, sourceNode.id, targetNode.id, language)
      : [];
  const inferredDisclaimer = inferred
    ? language === "th"
      ? "เป็นความเชื่อมโยงจากข้อมูลร่วม ไม่ใช่การยืนยันความสัมพันธ์ระหว่างบุคคล"
      : "This is a connection from shared records, not confirmation of a personal relationship"
    : null;

  const provenance = provenanceCases(edge, neighborhood.nodes);
  const mentioned = mentionedLabels({
    sentence: composed.sentence,
    followUpSentence: composed.followUpSentence,
    currentCaseLabel,
    signals: crossCaseSignals,
  });
  const provenanceAddsContext = provenance.some((item) => item.label && !mentioned.has(item.label) && !composed.sentence.includes(item.label));
  const showSeparateProvenance = provenanceAddsContext && !inferred && edge.relationshipType !== "PERSON_CASE";

  return {
    classification: edge.edgeKind,
    whyHeadingKind: inferred ? "INFERRED_PERSONS" : "CONNECTED",
    sourceLabel: safeDisplayLabel(sourceNode?.label ?? null),
    targetLabel: safeDisplayLabel(targetNode?.label ?? null),
    sentence: composed.sentence,
    followUpSentence: composed.followUpSentence,
    insufficientDetail: composed.insufficientDetail,
    inferredDisclaimer,
    inferredFacts,
    roleLabel,
    caseNumber: currentCaseLabel,
    arrestDate: caseMeta?.arrestDate ?? null,
    province: caseMeta?.province ?? null,
    reportingUnitText: caseMeta?.reportingUnitText ?? null,
    compactCaseContext: compactCaseContextLine({
      arrestDate: caseMeta?.arrestDate ?? null,
      province: caseMeta?.province ?? null,
      reportingUnitText: caseMeta?.reportingUnitText ?? null,
    }),
    provenanceCases: provenance,
    showSeparateProvenance,
    firstSeenAt: edge.firstSeenAt,
    lastSeenAt: edge.lastSeenAt,
    sharedEntities,
    sharedInCurrentCase: Boolean(caseNode && personNode),
    summaryChips: edge.relationshipType === "PERSON_CASE" ? summaryChipsFromNodes(sharedNodes, language) : [],
    crossCaseSignals,
    otherInCase,
    recurrence: recurrenceNode
      ? {
          label: safeDisplayLabel(recurrenceNode.label) ?? recurrenceNode.label,
          caseCount: recurrenceNode.caseCount,
          entityType: recurrenceNode.type,
          entityId: recurrenceNode.id,
        }
      : null,
    actions: investigationActionsForRelationship({
      edge,
      language,
      focusId: args.focusId,
      sourceNode,
      targetNode,
      personNode,
      caseNode,
      entityNode: openEntityNode,
    }),
    openCaseId: caseNode?.id ?? edge.sourceCaseIds[0] ?? null,
    openPersonId: personNode?.id ?? null,
    openEntity: openEntityNode ? { type: openEntityNode.type, id: openEntityNode.id } : null,
    focusPerson: personNode,
    focusCase: caseNode,
  };
}

export function relationshipEntityHref(type: DrugGraphNodeType, id: string): string | null {
  if (type === "LOCATION") return null;
  return drugEntityDetailPath(type, id);
}

export function explanationContainsForbiddenClaim(text: string): boolean {
  return /เจ้าของ|โทรหา|สนทนา|ติดต่อกับ|ก่อเหตุ|CDR|call history|owns the phone|จุดเสี่ยง|บุคคลสำคัญ|เบอร์ต้องสงสัย|ความเสี่ยงสูง|risk score|high confidence/i.test(
    text
  );
}
