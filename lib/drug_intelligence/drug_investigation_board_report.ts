/**
 * Investigation Board / Network print report (DI-10E.1).
 *
 * Shared HTML_PRINT builder for NETWORK_DATA (current workspace) and
 * BOARD_DATA (saved board). Hydrates factual nodes/edges with one
 * neighborhood query. Never writes board or factual records.
 *
 * Dirty saved-board contract: report the current visible workspace and
 * label it as unsaved. Ownership is still asserted against the saved board.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugInvestigationBoardRepository } from "@/lib/database/repositories/drug_investigation_board_repository";
import { BOARD_REPORT_SECTIONS } from "@/lib/drug_intelligence/drug_export_types";
import type { DrugExportMaskingMode } from "@/lib/drug_intelligence/drug_export_types";
import type { ResolvedDrugExportContextV1 } from "@/lib/drug_intelligence/drug_export_context";
import { parseInvestigationBoardState } from "@/lib/drug_intelligence/drug_investigation_board_workspace";
import {
  DrugGraphEntityNotFoundError,
  DrugNetworkGraphService,
  DrugPersonGraphNotFoundError,
} from "@/lib/drug_intelligence/drug_network_graph_service";
import {
  DRUG_GRAPH_HARD_MAX_NODES,
  type DrugGraphEdgeKind,
  type DrugGraphNodeType,
  type DrugGraphRelationshipType,
} from "@/lib/drug_intelligence/drug_network_graph_types";
import { drugGraphEdgeKindLabel } from "@/lib/drug_intelligence/drug_network_graph_explanation";
import { escapeHtml } from "@/lib/export/html";
import { translate, type Language, type TranslationKey } from "@/lib/i18n/dictionary";

export const INVESTIGATION_BOARD_REPORT_SCHEMA_VERSION = 1 as const;
export const INVESTIGATION_BOARD_REPORT_SYSTEM_NAME = "BPPIS Drug Intelligence";

/** recordCount = nodeCount + edgeCount */
export const BOARD_REPORT_RECORD_COUNT_RULE = "NODE_PLUS_EDGE" as const;

export class DrugExportBoardForbiddenError extends Error {
  readonly code = "BOARD_FORBIDDEN";
  constructor() {
    super("board forbidden");
  }
}

export class DrugExportBoardNotFoundError extends Error {
  readonly code = "BOARD_NOT_FOUND";
  constructor() {
    super("board not found");
  }
}

export class DrugExportInvalidWorkspaceError extends Error {
  readonly code = "INVALID_WORKSPACE";
  constructor() {
    super("invalid workspace");
  }
}

export class DrugExportTooManyBoardRowsError extends Error {
  readonly code = "TOO_MANY_ROWS";
  constructor() {
    super("too many rows");
  }
}

const DIRECT_RELATIONSHIP_TYPES = new Set<DrugGraphRelationshipType>([
  "PERSON_CASE",
  "PERSON_PHONE",
  "PERSON_SIM",
  "PERSON_DEVICE",
  "PERSON_VEHICLE",
  "CASE_PHONE",
  "CASE_SIM",
  "CASE_DEVICE",
  "CASE_VEHICLE",
  "CASE_LOCATION",
]);

const RELATIONSHIP_LABEL: Record<DrugGraphRelationshipType, TranslationKey> = {
  PERSON_CASE: "di.network.relPersonCase",
  PERSON_PHONE: "di.network.relPersonPhone",
  PERSON_SIM: "di.network.relPersonSim",
  PERSON_DEVICE: "di.network.relPersonDevice",
  PERSON_VEHICLE: "di.network.relPersonVehicle",
  CASE_PHONE: "di.network.relCasePhone",
  CASE_SIM: "di.network.relCaseSim",
  CASE_DEVICE: "di.network.relCaseDevice",
  CASE_VEHICLE: "di.network.relCaseVehicle",
  CASE_LOCATION: "di.network.relCaseLocation",
  SHARED_CASE: "di.network.relSharedCase",
  SHARED_PHONE: "di.network.relSharedPhone",
  SHARED_SIM: "di.network.relSharedSim",
  SHARED_DEVICE: "di.network.relSharedDevice",
  SHARED_VEHICLE: "di.network.relSharedVehicle",
};

const NODE_TYPE_LABEL: Record<DrugGraphNodeType, TranslationKey> = {
  PERSON: "di.export.boardNodePerson",
  PHONE: "di.export.sectionPhones",
  SIM: "di.export.sectionSims",
  DEVICE: "di.export.sectionDevices",
  VEHICLE: "di.export.sectionVehicles",
  CASE: "di.export.sectionCase",
  LOCATION: "di.export.sectionLocations",
};

export function edgeKindForRelationshipType(type: DrugGraphRelationshipType): DrugGraphEdgeKind {
  return DIRECT_RELATIONSHIP_TYPES.has(type) ? "DIRECT" : "INFERRED";
}

export interface InvestigationBoardReportNode {
  id: string;
  type: DrugGraphNodeType;
  label: string;
  caseCount: number;
}

export interface InvestigationBoardReportEdge {
  id: string;
  sourceLabel: string;
  targetLabel: string;
  relationshipType: DrugGraphRelationshipType;
  edgeKind: DrugGraphEdgeKind;
  evidenceCount: number;
}

export interface InvestigationBoardAnnotationSummary {
  total: number;
  rectangle: number;
  ellipse: number;
  text: number;
  line: number;
  arrow: number;
  image: number;
}

export interface DrugInvestigationBoardReportV1 {
  schemaVersion: typeof INVESTIGATION_BOARD_REPORT_SCHEMA_VERSION;
  systemName: typeof INVESTIGATION_BOARD_REPORT_SYSTEM_NAME;
  locale: Language;
  generatedAt: string;
  generatedBy: string;
  source: "CURRENT_WORKSPACE" | "SAVED_BOARD";
  dirty: boolean;
  boardId: string | null;
  boardTitle: string | null;
  boardUpdatedAt: string | null;
  focusType: DrugGraphNodeType | null;
  focusLabel: string | null;
  layoutMode: string | null;
  boardLocked: boolean;
  queryConditions: string[];
  nodeCount: number;
  edgeCount: number;
  annotationCount: number;
  nodes: InvestigationBoardReportNode[];
  edges: InvestigationBoardReportEdge[];
  annotations: InvestigationBoardAnnotationSummary;
  methodologyNotes: string[];
}

function t(locale: Language, key: TranslationKey): string {
  return translate(key, locale);
}

function countAnnotationTypes(types: readonly string[]): InvestigationBoardAnnotationSummary {
  const summary: InvestigationBoardAnnotationSummary = {
    total: types.length,
    rectangle: 0,
    ellipse: 0,
    text: 0,
    line: 0,
    arrow: 0,
    image: 0,
  };
  for (const type of types) {
    if (type === "RECTANGLE") summary.rectangle += 1;
    else if (type === "ELLIPSE") summary.ellipse += 1;
    else if (type === "TEXT") summary.text += 1;
    else if (type === "LINE") summary.line += 1;
    else if (type === "ARROW") summary.arrow += 1;
    else if (type === "IMAGE") summary.image += 1;
  }
  return summary;
}

function boardRecordCount(nodeCount: number, edgeCount: number): number {
  return nodeCount + edgeCount;
}

export function investigationBoardRecordCount(report: Pick<DrugInvestigationBoardReportV1, "nodeCount" | "edgeCount">): number {
  return boardRecordCount(report.nodeCount, report.edgeCount);
}

export async function buildDrugInvestigationBoardReportV1(
  db: DatabaseClient,
  input: {
    exportType: "NETWORK_DATA" | "BOARD_DATA";
    context: ResolvedDrugExportContextV1;
    generatedBy: string;
    maskingMode: DrugExportMaskingMode;
  }
): Promise<DrugInvestigationBoardReportV1> {
  const locale = input.context.locale;
  const workspace = input.context.workspace;
  if (workspace && workspace.nodeIds.length > DRUG_GRAPH_HARD_MAX_NODES) {
    throw new DrugExportTooManyBoardRowsError();
  }

  let boardTitle: string | null = workspace?.title?.trim() || null;
  let boardUpdatedAt: string | null = null;
  let boardId: string | null = null;
  let savedState = null as ReturnType<typeof parseInvestigationBoardState>;
  let savedAnnotationTypes: string[] = [];

  if (input.exportType === "BOARD_DATA") {
    boardId = input.context.board?.boardId ?? null;
    if (!boardId) throw new DrugExportInvalidWorkspaceError();
    const repo = new DrugInvestigationBoardRepository(db);
    const row = await repo.findById(boardId);
    if (!row) throw new DrugExportBoardNotFoundError();
    if (row.ownerActorId !== input.context.actorId) throw new DrugExportBoardForbiddenError();
    savedState = parseInvestigationBoardState(row.state);
    boardTitle = row.title;
    boardUpdatedAt = row.updatedAt.toISOString();
    savedAnnotationTypes = savedState?.annotations.map((ann) => ann.type) ?? [];
  } else if (!input.context.network?.focusType || !input.context.network.focusId) {
    throw new DrugExportInvalidWorkspaceError();
  }

  const dirty = Boolean(workspace?.dirty && boardId);
  const source: "CURRENT_WORKSPACE" | "SAVED_BOARD" =
    input.exportType === "BOARD_DATA" && !dirty ? "SAVED_BOARD" : "CURRENT_WORKSPACE";

  const useCurrentWorkspace = input.exportType === "NETWORK_DATA" || dirty;
  const focusType = useCurrentWorkspace
    ? (input.context.network?.focusType ?? savedState?.graphContext.focusType ?? null)
    : (savedState?.graphContext.focusType ?? input.context.network?.focusType ?? null);
  const focusId = useCurrentWorkspace
    ? (input.context.network?.focusId ?? savedState?.graphContext.focusId ?? null)
    : (savedState?.graphContext.focusId ?? input.context.network?.focusId ?? null);
  const requestedDepth = useCurrentWorkspace
    ? input.context.network?.depth ?? savedState?.graphContext.depth
    : savedState?.graphContext.depth ?? input.context.network?.depth;
  const depth = requestedDepth === 2 ? 2 : 1;

  const dateFrom = useCurrentWorkspace
    ? workspace?.dateFrom ?? savedState?.graphContext.dateFrom
    : savedState?.graphContext.dateFrom ?? workspace?.dateFrom;
  const dateTo = useCurrentWorkspace
    ? workspace?.dateTo ?? savedState?.graphContext.dateTo
    : savedState?.graphContext.dateTo ?? workspace?.dateTo;

  const queryConditions: string[] = [];
  if (dateFrom || dateTo) {
    queryConditions.push(
      `${t(locale, "di.export.boardQueryCondition")}: ${dateFrom ?? "—"} – ${dateTo ?? "—"}`
    );
  }

  let nodes: InvestigationBoardReportNode[] = [];
  let edges: InvestigationBoardReportEdge[] = [];
  let focusLabel: string | null = null;

  if (focusType && focusId) {
    const graph = new DrugNetworkGraphService(db);
    try {
      const neighborhood = await graph.getNeighborhood(
        {
          entityType: focusType,
          entityId: focusId,
          depth,
          maxNodes: DRUG_GRAPH_HARD_MAX_NODES,
          dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`) : undefined,
          dateTo: dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : undefined,
        },
        { canViewFull: input.maskingMode === "FULL" }
      );
      const allowedIds =
        useCurrentWorkspace && workspace?.nodeIds.length ? new Set(workspace.nodeIds) : null;
      const included = allowedIds
        ? neighborhood.nodes.filter((node) => allowedIds.has(node.id))
        : neighborhood.nodes;
      if (included.length > DRUG_GRAPH_HARD_MAX_NODES) {
        throw new DrugExportTooManyBoardRowsError();
      }
      const includedIds = new Set(included.map((node) => node.id));
      nodes = included.map((node) => ({
        id: node.id,
        type: node.type,
        label: node.maskedLabel ?? node.label,
        caseCount: node.caseCount,
      }));
      const labelById = new Map(nodes.map((node) => [node.id, node.label]));
      edges = neighborhood.edges
        .filter((edge) => includedIds.has(edge.source) && includedIds.has(edge.target))
        .map((edge) => ({
          id: edge.id,
          sourceLabel: labelById.get(edge.source) ?? "—",
          targetLabel: labelById.get(edge.target) ?? "—",
          relationshipType: edge.relationshipType,
          edgeKind: edgeKindForRelationshipType(edge.relationshipType),
          evidenceCount: edge.evidenceCount,
        }));
      const focusNode = included.find((node) => node.id === focusId);
      if (focusNode) focusLabel = focusNode.maskedLabel ?? focusNode.label;
    } catch (error) {
      if (error instanceof DrugPersonGraphNotFoundError || error instanceof DrugGraphEntityNotFoundError) {
        throw new DrugExportInvalidWorkspaceError();
      }
      throw error;
    }
  } else {
    throw new DrugExportInvalidWorkspaceError();
  }

  const annotationTypes = useCurrentWorkspace
    ? (workspace?.annotationTypes ?? [])
    : savedAnnotationTypes;
  const annotations = countAnnotationTypes(annotationTypes);

  return {
    schemaVersion: INVESTIGATION_BOARD_REPORT_SCHEMA_VERSION,
    systemName: INVESTIGATION_BOARD_REPORT_SYSTEM_NAME,
    locale,
    generatedAt: input.context.generatedAt,
    generatedBy: input.generatedBy,
    source,
    dirty,
    boardId,
    boardTitle,
    boardUpdatedAt,
    focusType,
    focusLabel,
    layoutMode: useCurrentWorkspace
      ? workspace?.layoutMode ?? savedState?.presentation.layoutMode ?? null
      : savedState?.presentation.layoutMode ?? workspace?.layoutMode ?? null,
    boardLocked: useCurrentWorkspace
      ? workspace?.boardLocked ?? savedState?.presentation.boardLocked ?? false
      : savedState?.presentation.boardLocked ?? workspace?.boardLocked ?? false,
    queryConditions,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    annotationCount: annotations.total,
    nodes,
    edges,
    annotations,
    methodologyNotes: [
      t(locale, "di.export.boardMethodFact"),
      t(locale, "di.export.boardMethodInferred"),
      t(locale, "di.export.boardMethodAnnotation"),
      t(locale, "di.export.boardMethodSupport"),
      t(locale, "di.export.notAiGenerated"),
      t(locale, "di.export.notRiskScore"),
    ],
  };
}

function dash(value: string): string {
  return escapeHtml(value || "—");
}

function table(headers: string[], rows: string[][]): string {
  return `<table>
    <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
  </table>`;
}

function empty(locale: Language): string {
  return `<p class="empty">${escapeHtml(t(locale, "di.export.boardEmpty"))}</p>`;
}

export function renderDrugInvestigationBoardReportHtml(report: DrugInvestigationBoardReportV1): string {
  const locale = report.locale;
  const official = t(locale, "di.export.officialUse");
  const sourceLabel =
    report.source === "SAVED_BOARD"
      ? t(locale, "di.export.boardSourceSaved")
      : t(locale, "di.export.boardSourceWorkspace");
  const nodeRows = report.nodes.map((node, index) => [
    dash(String(index + 1)),
    dash(t(locale, NODE_TYPE_LABEL[node.type])),
    dash(node.label),
    dash(String(node.caseCount)),
  ]);
  const edgeRows = report.edges.map((edge) => [
    dash(edge.sourceLabel),
    dash(t(locale, RELATIONSHIP_LABEL[edge.relationshipType])),
    dash(edge.targetLabel),
    dash(edge.edgeKind === "DIRECT" ? t(locale, "di.export.boardFact") : t(locale, "di.export.boardInferred")),
    dash(String(edge.evidenceCount)),
    dash(drugGraphEdgeKindLabel(edge.edgeKind, locale)),
  ]);
  const annotationRows = [
    [dash(t(locale, "di.export.boardAnnRectangle")), dash(String(report.annotations.rectangle))],
    [dash(t(locale, "di.export.boardAnnEllipse")), dash(String(report.annotations.ellipse))],
    [dash(t(locale, "di.export.boardAnnText")), dash(String(report.annotations.text))],
    [dash(t(locale, "di.export.boardAnnLine")), dash(String(report.annotations.line))],
    [dash(t(locale, "di.export.boardAnnArrow")), dash(String(report.annotations.arrow))],
    [dash(t(locale, "di.export.boardAnnImage")), dash(String(report.annotations.image))],
  ];

  return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(t(locale, "di.export.boardReportTitle"))}</title>
<style>
  @page { size: A4 landscape; margin: 12mm 12mm 16mm; @bottom-right { content: counter(page); } }
  body { font-family: "Sarabun", "Noto Sans Thai", "Thonburi", "Leelawadee UI", "Segoe UI", Tahoma, sans-serif; color: #111; font-size: 12px; line-height: 1.45; margin: 0; }
  header { border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 16px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  h2 { font-size: 13px; margin: 18px 0 8px; page-break-after: avoid; }
  .meta, footer, .note { color: #333; font-size: 11px; }
  section { page-break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #bbb; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f3f3f3; font-weight: 600; }
  ul { margin: 0 0 8px; padding-left: 18px; }
  .empty { color: #555; margin: 0 0 8px; }
  footer { border-top: 1px solid #111; margin-top: 24px; padding-top: 8px; }
  @media print { header, h2 { page-break-after: avoid; } }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(t(locale, "di.export.boardReportTitle"))}</h1>
  <p class="meta">${escapeHtml(t(locale, "di.export.boardReportSubtitle"))}</p>
  <p class="meta">${escapeHtml(official)}</p>
  <p class="meta">${escapeHtml(t(locale, "di.export.generatedAt"))}: ${escapeHtml(report.generatedAt)}</p>
</header>
<section>
  <h2>1. ${escapeHtml(t(locale, "di.export.boardSectionHeader"))}</h2>
  <table>
    <tbody>
      <tr><th scope="row">${escapeHtml(t(locale, "di.export.boardSource"))}</th><td>${dash(sourceLabel)}</td></tr>
      <tr><th scope="row">${escapeHtml(t(locale, "di.export.boardTitle"))}</th><td>${dash(report.boardTitle ?? t(locale, "di.export.boardUntitled"))}</td></tr>
      <tr><th scope="row">${escapeHtml(t(locale, "di.export.boardFocus"))}</th><td>${dash([report.focusType, report.focusLabel].filter(Boolean).join(" · "))}</td></tr>
      <tr><th scope="row">${escapeHtml(t(locale, "di.export.boardLayout"))}</th><td>${dash(report.layoutMode ?? "—")}</td></tr>
      <tr><th scope="row">${escapeHtml(t(locale, "di.export.generatedBy"))}</th><td>${dash(report.generatedBy)}</td></tr>
    </tbody>
  </table>
  ${report.dirty ? `<p class="note">${escapeHtml(t(locale, "di.export.boardDirtyNote"))}</p>` : ""}
  ${report.queryConditions.map((line) => `<p class="note">${escapeHtml(line)}</p>`).join("")}
</section>
<section>
  <h2>2. ${escapeHtml(t(locale, "di.export.boardSectionSummary"))}</h2>
  <table>
    <tbody>
      <tr><th scope="row">${escapeHtml(t(locale, "di.export.boardNodeCount"))}</th><td>${dash(String(report.nodeCount))}</td></tr>
      <tr><th scope="row">${escapeHtml(t(locale, "di.export.boardEdgeCount"))}</th><td>${dash(String(report.edgeCount))}</td></tr>
      <tr><th scope="row">${escapeHtml(t(locale, "di.export.boardAnnotationCount"))}</th><td>${dash(String(report.annotationCount))}</td></tr>
    </tbody>
  </table>
</section>
<section>
  <h2>3. ${escapeHtml(t(locale, "di.export.boardSectionLegend"))}</h2>
  <ul>
    <li>${escapeHtml(t(locale, "di.export.boardLegendFact"))}</li>
    <li>${escapeHtml(t(locale, "di.export.boardLegendInferred"))}</li>
    <li>${escapeHtml(t(locale, "di.export.boardLegendAnnotation"))}</li>
    <li>${escapeHtml(t(locale, "di.export.boardLegendQuery"))}</li>
  </ul>
</section>
<section>
  <h2>4. ${escapeHtml(t(locale, "di.export.boardSectionNodes"))}</h2>
  ${
    nodeRows.length
      ? table(
          [
            t(locale, "di.export.rank"),
            t(locale, "di.export.boardNodeType"),
            t(locale, "di.export.boardNodeLabel"),
            t(locale, "di.command.areasColCases"),
          ],
          nodeRows
        )
      : empty(locale)
  }
</section>
<section>
  <h2>5. ${escapeHtml(t(locale, "di.export.boardSectionEdges"))}</h2>
  ${
    edgeRows.length
      ? table(
          [
            t(locale, "di.export.boardEdgeSource"),
            t(locale, "di.export.boardEdgeType"),
            t(locale, "di.export.boardEdgeTarget"),
            t(locale, "di.export.boardSemanticType"),
            t(locale, "di.export.boardEvidence"),
            t(locale, "di.export.boardEdgeKind"),
          ],
          edgeRows
        )
      : empty(locale)
  }
</section>
<section>
  <h2>6. ${escapeHtml(t(locale, "di.export.boardSectionAnnotations"))}</h2>
  <p class="note">${escapeHtml(t(locale, "di.export.boardAnnotationNote"))}</p>
  ${table([t(locale, "di.export.indicator"), t(locale, "di.export.records")], annotationRows)}
</section>
<section>
  <h2>7. ${escapeHtml(t(locale, "di.export.sectionMethodology"))}</h2>
  <ul>${report.methodologyNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
</section>
<footer>
  <p>${escapeHtml(t(locale, "di.export.generatedBy"))}: ${dash(report.generatedBy)}</p>
  <p>${escapeHtml(t(locale, "di.export.generatedAt"))}: ${escapeHtml(report.generatedAt)}</p>
  <p>${escapeHtml(report.systemName)} · ${escapeHtml(official)}</p>
</footer>
</body>
</html>`;
}

export const BOARD_REPORT_SECTION_KEYS: Record<(typeof BOARD_REPORT_SECTIONS)[number], TranslationKey> = {
  header: "di.export.boardSectionHeader",
  summary: "di.export.boardSectionSummary",
  legend: "di.export.boardSectionLegend",
  nodes: "di.export.boardSectionNodes",
  edges: "di.export.boardSectionEdges",
  annotations: "di.export.boardSectionAnnotations",
  methodology: "di.export.sectionMethodology",
};
