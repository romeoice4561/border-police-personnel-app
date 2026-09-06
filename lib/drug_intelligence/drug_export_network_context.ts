/**
 * Network / Investigation Board export context (DI-10E.1).
 *
 * Dirty saved-board contract (explicit):
 * report the current visible workspace and label it as unsaved.
 * Server still authorizes the saved board owner before generation.
 * Export never persists the dirty snapshot.
 */

import type { DrugExportContextV1Input } from "@/lib/drug_intelligence/drug_export_context";
import type { DrugExportType } from "@/lib/drug_intelligence/drug_export_types";
import type { DrugGraphNodeType } from "@/lib/drug_intelligence/drug_network_graph_types";
import type { DrugNetworkLayoutMode } from "@/lib/drug_intelligence/drug_network_graph_layout";

export const DIRTY_BOARD_REPORT_CONTRACT = "CURRENT_VISIBLE_WORKSPACE" as const;

export type InvestigationBoardAnnotationType =
  | "RECTANGLE"
  | "ELLIPSE"
  | "TEXT"
  | "LINE"
  | "ARROW"
  | "IMAGE";

export function investigationBoardExportType(boardId: string | null | undefined): Extract<DrugExportType, "NETWORK_DATA" | "BOARD_DATA"> {
  return boardId ? "BOARD_DATA" : "NETWORK_DATA";
}

export function buildInvestigationBoardExportContext(input: {
  locale: "th" | "en";
  boardId?: string | null;
  dirty?: boolean;
  title?: string | null;
  layoutMode?: DrugNetworkLayoutMode | null;
  boardLocked?: boolean;
  focusType: DrugGraphNodeType | null;
  focusId: string | null;
  focusLabel?: string | null;
  depth?: 1 | 2;
  dateFrom?: string | null;
  dateTo?: string | null;
  nodeIds: readonly string[];
  annotationTypes: readonly InvestigationBoardAnnotationType[];
}): DrugExportContextV1Input {
  const context: DrugExportContextV1Input = {
    schemaVersion: 1,
    locale: input.locale,
    sourceRoute: "/drug-intelligence/network",
    workspace: {
      dirty: Boolean(input.dirty && input.boardId),
      title: input.title?.trim() || undefined,
      layoutMode: input.layoutMode ?? undefined,
      boardLocked: input.boardLocked,
      focusLabel: input.focusLabel?.trim() || undefined,
      nodeIds: [...input.nodeIds],
      annotationTypes: [...input.annotationTypes],
      dateFrom: input.dateFrom || undefined,
      dateTo: input.dateTo || undefined,
    },
  };
  if (input.focusType && input.focusId) {
    context.network = {
      focusType: input.focusType,
      focusId: input.focusId,
      depth: input.depth === 2 ? 2 : 1,
    };
  }
  if (input.boardId) {
    context.board = { boardId: input.boardId };
  }
  return context;
}
