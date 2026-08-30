/**
 * DrugNetworkStatusBar (Phase DI-9.1, Section 7/8; extended DI-9.2 Section
 * 16 with pin count / board lock state).
 *
 * A compact, always-visible strip of factual workspace state — node/edge
 * counts, current selection, layout mode, zoom%, and a truncated-result
 * warning. Purely presentational: every value is either already computed
 * by the page (nodeCount/edgeCount/selection/layoutLabel/truncated) or
 * read live from React Flow's own `useViewport()` hook (zoom) — no new
 * API call, no new state, no recomputation of anything the canvas didn't
 * already have.
 *
 * `pinnedCount`/`boardLocked` are optional and only ever passed in Analyst
 * Mode (View Mode has no editing controls, so these metrics would be
 * meaningless clutter there — Section 16).
 *
 * Responsive (Section 8/16): desktop shows every metric in one row; on
 * narrow viewports only the highest-value items (nodes/edges/truncated)
 * remain, so this never causes horizontal overflow at 390px. Pin/lock
 * details collapse on mobile along with the other secondary metrics.
 */
"use client";

import { useViewport } from "@xyflow/react";
import { Info, Lock } from "lucide-react";
import { useT } from "@/components/i18n/language_provider";

export interface DrugNetworkStatusBarProps {
  nodeCount: number;
  edgeCount: number;
  /** Human-readable label for whatever is currently selected (a node's label, an edge's relationship label), or null when nothing is selected. */
  selectedLabel: string | null;
  layoutLabel: string;
  truncated: boolean;
  /** DI-9.2 Section 16: number of currently-pinned nodes. Omit (or 0) outside Analyst Mode. */
  pinnedCount?: number;
  /** DI-9.2 Section 16: whether the board is currently drag-locked. */
  boardLocked?: boolean;
  /** DI-9.4: number of analyst annotation objects currently on the canvas. Omit (or 0) outside Analyst Mode. */
  annotationCount?: number;
}

export function DrugNetworkStatusBar({ nodeCount, edgeCount, selectedLabel, layoutLabel, truncated, pinnedCount, boardLocked, annotationCount }: DrugNetworkStatusBarProps) {
  const { t } = useT();
  const { zoom } = useViewport();
  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-border bg-neutral-bg/60 px-3 py-2 text-xs text-muted">
      <span>
        {t("di.network.statusNodes")}: <span className="font-medium text-foreground">{nodeCount.toLocaleString()}</span>
      </span>
      <span>
        {t("di.network.statusEdges")}: <span className="font-medium text-foreground">{edgeCount.toLocaleString()}</span>
      </span>
      <span className="hidden sm:inline">
        {t("di.network.statusSelected")}: <span className="font-medium text-foreground">{selectedLabel ?? t("di.network.statusNoneSelected")}</span>
      </span>
      <span className="hidden sm:inline">
        {t("di.network.statusLayout")}: <span className="font-medium text-foreground">{layoutLabel}</span>
      </span>
      <span className="hidden sm:inline">
        {t("di.network.statusZoom")}: <span className="font-medium text-foreground">{zoomPercent}%</span>
      </span>
      {typeof pinnedCount === "number" && pinnedCount > 0 ? (
        <span className="hidden sm:inline">
          {t("di.network.statusPinned")}: <span className="font-medium text-foreground">{pinnedCount.toLocaleString()}</span>
        </span>
      ) : null}
      {boardLocked ? (
        <span className="hidden items-center gap-1 font-medium text-foreground sm:inline-flex">
          <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
          {t("di.network.statusBoardLocked")}
        </span>
      ) : null}
      {typeof annotationCount === "number" && annotationCount > 0 ? (
        <span className="hidden sm:inline" data-testid="status-annotation-count">
          {t("di.network.statusAnnotations")}: <span className="font-medium text-foreground">{annotationCount.toLocaleString()}</span>
        </span>
      ) : null}
      {truncated ? (
        <span role="status" className="ml-auto flex items-center gap-1 font-medium text-warning">
          <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t("di.network.truncatedShort")}
        </span>
      ) : null}
    </div>
  );
}
