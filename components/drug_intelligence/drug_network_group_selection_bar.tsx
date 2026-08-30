/**
 * Group selection action bar (DI-9.4.4).
 *
 * Shown when multiple canvas objects are selected. Destructive actions apply
 * ONLY to analyst annotations — factual nodes are never deleted.
 */
"use client";

import { Copy, Trash2 } from "lucide-react";
import { useT } from "@/components/i18n/language_provider";
import { mixedSelectionDeleteLabelTh } from "@/lib/drug_intelligence/drug_network_annotations";

export interface DrugNetworkGroupSelectionBarProps {
  factualCount: number;
  annotationCount: number;
  boardLocked: boolean;
  canMutate: boolean;
  onDeleteAnnotations: () => void;
  onDuplicateAnnotations: () => void;
}

export function DrugNetworkGroupSelectionBar({
  factualCount,
  annotationCount,
  boardLocked,
  canMutate,
  onDeleteAnnotations,
  onDuplicateAnnotations,
}: DrugNetworkGroupSelectionBarProps) {
  const { t } = useT();
  const total = factualCount + annotationCount;
  if (total <= 1) return null;

  const deleteLabel = mixedSelectionDeleteLabelTh(annotationCount, factualCount);
  const deleteDisabled = boardLocked || !canMutate || annotationCount <= 0;
  const dupDisabled = boardLocked || !canMutate || annotationCount <= 0;

  return (
    <div
      className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-surface/95 px-3 py-1.5 shadow-lg backdrop-blur-sm"
      data-testid="group-selection-bar"
      onPointerDown={(e) => e.stopPropagation()}
      role="toolbar"
      aria-label={t("di.network.groupSelectionLabel")}
    >
      <span className="text-xs text-foreground" data-testid="group-selection-summary" aria-live="polite">
        {t("di.network.selectionCount").replace("{count}", String(total))}
        <span className="text-muted">
          {" "}
          ({factualCount > 0 ? t("di.network.selectionFactualCount").replace("{count}", String(factualCount)) : null}
          {factualCount > 0 && annotationCount > 0 ? " · " : null}
          {annotationCount > 0 ? t("di.network.selectionAnnotationCount").replace("{count}", String(annotationCount)) : null})
        </span>
      </span>

      <button
        type="button"
        disabled={dupDisabled}
        onClick={() => !dupDisabled && onDuplicateAnnotations()}
        title={t("di.network.groupDuplicateAnnotations")}
        aria-label={t("di.network.groupDuplicateAnnotations")}
        className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs text-muted transition-colors hover:bg-neutral-bg hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40"
        data-testid="group-duplicate-btn"
      >
        <Copy className="h-3.5 w-3.5" aria-hidden />
        {t("di.network.groupDuplicateAnnotations")}
      </button>

      <button
        type="button"
        disabled={deleteDisabled}
        onClick={() => !deleteDisabled && onDeleteAnnotations()}
        title={deleteDisabled && factualCount > 0 && annotationCount <= 0
          ? t("di.network.groupDeleteFactualProtected")
          : deleteLabel}
        aria-label={deleteLabel}
        className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs text-critical transition-colors hover:bg-critical-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-critical disabled:cursor-not-allowed disabled:opacity-40"
        data-testid="group-delete-btn"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        {deleteLabel}
      </button>
    </div>
  );
}
