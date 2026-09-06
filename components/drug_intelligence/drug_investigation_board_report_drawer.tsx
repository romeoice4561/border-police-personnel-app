"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import {
  buildInvestigationBoardExportContext,
  investigationBoardExportType,
  type InvestigationBoardAnnotationType,
} from "@/lib/drug_intelligence/drug_export_network_context";
import { drugIntelligenceClient } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { DrugExportPreviewV1 } from "@/lib/drug_intelligence/drug_export_types";
import type { DrugGraphNodeType } from "@/lib/drug_intelligence/drug_network_graph_types";
import type { DrugNetworkLayoutMode } from "@/lib/drug_intelligence/drug_network_graph_layout";
import { ApiClientError } from "@/lib/ui/api_client";

function openPrintView(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    URL.revokeObjectURL(url);
    throw new Error("popup-blocked");
  }
  opened.opener = null;
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function DrugInvestigationBoardReportDrawer({
  open,
  onClose,
  boardId,
  dirty,
  title,
  layoutMode,
  boardLocked,
  focusType,
  focusId,
  focusLabel,
  depth,
  dateFrom,
  dateTo,
  nodeIds,
  annotationTypes,
  nodeCount,
  edgeCount,
  annotationCount,
}: {
  open: boolean;
  onClose: () => void;
  boardId: string | null;
  dirty: boolean;
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
  nodeCount: number;
  edgeCount: number;
  annotationCount: number;
}) {
  const { user } = useAuth();
  const { t, language } = useT();
  const [result, setResult] = useState<{ key: string; preview: DrugExportPreviewV1 | null; error: string | null } | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const exportType = investigationBoardExportType(boardId);
  const context = useMemo(
    () =>
      buildInvestigationBoardExportContext({
        locale: language,
        boardId,
        dirty,
        title,
        layoutMode,
        boardLocked,
        focusType,
        focusId,
        focusLabel,
        depth,
        dateFrom,
        dateTo,
        nodeIds,
        annotationTypes,
      }),
    [
      language,
      boardId,
      dirty,
      title,
      layoutMode,
      boardLocked,
      focusType,
      focusId,
      focusLabel,
      depth,
      dateFrom,
      dateTo,
      nodeIds,
      annotationTypes,
    ]
  );
  const previewKey = `${open}:${user?.id ?? ""}:${exportType}:${JSON.stringify(context)}`;
  const preview = result?.key === previewKey ? result.preview : null;
  const error = result?.key === previewKey ? result.error : null;
  const previewBusy = open && Boolean(user) && result?.key !== previewKey;
  const busy = previewBusy || downloadBusy;
  const sourceLabel = boardId && !dirty ? t("di.export.boardSourceSaved") : t("di.export.boardSourceWorkspace");

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    const key = previewKey;
    drugIntelligenceClient
      .previewExport({
        actorId: user.id,
        exportType,
        format: "HTML_PRINT",
        masking: "MASKED",
        context,
      })
      .then((data) => {
        if (!cancelled) setResult({ key, preview: data, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResult({
            key,
            preview: null,
            error: err instanceof ApiClientError ? err.message : t("di.export.downloadFailed"),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, user, t, previewKey, exportType, context]);

  async function generate() {
    if (!user) return;
    setDownloadBusy(true);
    try {
      const downloaded = await drugIntelligenceClient.downloadExport({
        actorId: user.id,
        exportType,
        format: "HTML_PRINT",
        masking: "MASKED",
        context,
      });
      openPrintView(new Blob([downloaded.blob], { type: "text/html;charset=utf-8" }));
    } catch (err) {
      setResult({
        key: previewKey,
        preview,
        error: err instanceof ApiClientError ? err.message : t("di.export.downloadFailed"),
      });
    } finally {
      setDownloadBusy(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} titleId="drug-board-report-title" title={t("di.export.boardReportTitle")}>
      <div className="space-y-4 px-5 py-4">
        <div>
          <p className="text-xs font-medium text-muted">{t("di.export.currentFilters")}</p>
          <p className="mt-1 text-sm text-foreground">{sourceLabel}</p>
          <p className="text-sm text-foreground">
            {t("di.export.boardTitle")}: {title?.trim() || t("di.export.boardUntitled")}
          </p>
          <p className="text-sm text-foreground">
            {t("di.export.boardFocus")}: {[focusType, focusLabel].filter(Boolean).join(" · ") || "—"}
          </p>
          {dirty ? <p className="text-sm text-foreground">{t("di.export.boardDirtyNote")}</p> : null}
        </div>
        <p className="text-sm text-foreground">
          {t("di.export.boardNodeCount")}: <span className="font-medium">{nodeCount}</span>
        </p>
        <p className="text-sm text-foreground">
          {t("di.export.boardEdgeCount")}: <span className="font-medium">{edgeCount}</span>
        </p>
        <p className="text-sm text-foreground">
          {t("di.export.boardAnnotationCount")}: <span className="font-medium">{annotationCount}</span>
        </p>
        <p className="text-sm text-muted">{t("di.export.boardMaskingNotice")}</p>
        <p className="text-sm text-muted">
          {t("di.export.boardLegendFact")}; {t("di.export.boardLegendInferred")}; {t("di.export.boardLegendAnnotation")}
        </p>
        <p className="text-sm text-foreground">
          {t("di.export.estimatedRecords")}:{" "}
          <span className="font-medium">{preview?.estimatedRecordCount ?? (busy ? "…" : nodeCount + edgeCount)}</span>
        </p>
        {preview?.warnings.map((warning) => (
          <p key={warning} className="text-sm text-muted">
            {warning}
          </p>
        ))}
        {error ? (
          <p className="text-sm text-serious" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={generate}
            disabled={busy || !preview?.implemented || nodeCount < 1}
            aria-label={t("di.export.printReport")}
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            {t("di.export.printReport")}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            {t("di.export.close")}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
