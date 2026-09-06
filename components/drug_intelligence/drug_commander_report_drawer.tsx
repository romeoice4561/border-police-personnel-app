"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { commanderUrlStateToExportContext } from "@/lib/drug_intelligence/drug_export_commander_context";
import type { CommanderUrlState } from "@/lib/drug_intelligence/drug_commander_scope";
import { commanderPeriodKind, formatCommanderPeriodLabel } from "@/lib/drug_intelligence/drug_commander_scope";
import { drugIntelligenceClient } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { DrugExportPreviewV1 } from "@/lib/drug_intelligence/drug_export_types";
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

function orgLabel(state: CommanderUrlState, allUnits: string): string {
  const parts = [state.hqId, state.regionId, state.battalionId, state.companyId].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : allUnits;
}

export function DrugCommanderReportDrawer({
  open,
  onClose,
  urlState,
  displayFiscalYearTh,
}: {
  open: boolean;
  onClose: () => void;
  urlState: CommanderUrlState;
  displayFiscalYearTh?: string;
}) {
  const { user } = useAuth();
  const { t, language } = useT();
  const [result, setResult] = useState<{ key: string; preview: DrugExportPreviewV1 | null; error: string | null } | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const previewKey = `${open}:${user?.id ?? ""}:${language}:${JSON.stringify(urlState)}`;
  const preview = result?.key === previewKey ? result.preview : null;
  const error = result?.key === previewKey ? result.error : null;
  const previewBusy = open && Boolean(user) && result?.key !== previewKey;
  const busy = previewBusy || downloadBusy;
  const periodKind = commanderPeriodKind(urlState);
  const periodLabel = formatCommanderPeriodLabel(urlState, displayFiscalYearTh ?? t("di.command.filterFy"));
  const fyShown = periodKind !== "custom" && Boolean(urlState.fy || displayFiscalYearTh);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    const key = previewKey;
    drugIntelligenceClient
      .previewExport({
        actorId: user.id,
        exportType: "COMMANDER_REPORT",
        format: "HTML_PRINT",
        masking: "MASKED",
        context: commanderUrlStateToExportContext(urlState, language),
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
    // previewKey already includes serialized urlState + locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- urlState identity changes every parent render
  }, [open, user, language, t, previewKey]);

  async function generate() {
    if (!user) return;
    setDownloadBusy(true);
    try {
      const downloaded = await drugIntelligenceClient.downloadExport({
        actorId: user.id,
        exportType: "COMMANDER_REPORT",
        format: "HTML_PRINT",
        masking: "MASKED",
        context: commanderUrlStateToExportContext(urlState, language),
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
    <Drawer open={open} onClose={onClose} titleId="drug-commander-report-title" title={t("di.export.commanderReport")}>
      <div className="space-y-4 px-5 py-4">
        <div>
          <p className="text-xs font-medium text-muted">{t("di.export.currentFilters")}</p>
          <p className="mt-1 text-sm text-foreground">
            {t("di.export.periodScope")}: {periodLabel}
          </p>
          {fyShown ? (
            <p className="text-sm text-foreground">
              {t("di.export.appliedFiscalYear")}: {urlState.fy ?? displayFiscalYearTh}
            </p>
          ) : (
            <p className="text-sm text-foreground">{t("di.export.explicitDates")}</p>
          )}
          <p className="text-sm text-foreground">
            {t("di.export.organizationScope")}: {orgLabel(urlState, t("di.command.scopeAllReportingUnits"))}
          </p>
          <p className="text-sm text-foreground">
            {t("di.export.provinceScope")}: {urlState.province || t("di.command.scopeAllProvinces")}
          </p>
          <p className="text-sm text-foreground">
            {t("di.export.comparisonPeriod")}: {t("di.command.comparisonPrevious")}
          </p>
        </div>
        <p className="text-sm text-muted">
          {t("di.export.sections")}: {t("di.export.sectionSummary")}, {t("di.export.sectionKpis")}, {t("di.export.sectionSeizures")}, {t("di.export.sectionTrend")}, {t("di.export.sectionAreas")}, {t("di.export.sectionUnits")}, {t("di.export.sectionAttention")}
        </p>
        <p className="text-sm text-muted">{t("di.export.attentionOperational")}</p>
        <p className="text-sm text-foreground">
          {t("di.export.estimatedRecords")}:{" "}
          <span className="font-medium">{preview?.estimatedRecordCount ?? (busy ? "…" : "—")}</span>
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
          <Button type="button" size="sm" onClick={generate} disabled={busy || !preview?.implemented}>
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
