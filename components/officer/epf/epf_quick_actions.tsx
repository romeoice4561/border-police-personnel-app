/**
 * EpfQuickActions (Phase 46 — Foundation; Phase 46B — split into two visual
 * groups so future capabilities read as "not yet built" rather than
 * "broken": Available Actions (real, wired) and Future Capabilities (each
 * carries a small "Future Phase" badge instead of just disabled/greyed
 * styling).
 *
 * Download Selected only appears when there is an active selection (this
 * phase does not add a selection UI to document cards — the prop is always
 * undefined/0 for now, so the button is correctly absent rather than a fake
 * enabled/disabled state).
 */
"use client";

import { Upload, ChevronsDown, ChevronsUp, Download, Printer, FileOutput, ScanText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language_provider";

function FutureActionButton({ icon: Icon, label, comingSoon }: { icon: typeof Printer; label: string; comingSoon: string }) {
  return (
    <div
      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted/80"
      title={comingSoon}
      aria-label={`${label} — ${comingSoon}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
      <Badge tone="neutral" className="ml-0.5 px-1.5 py-0 text-[9px]">
        {comingSoon}
      </Badge>
    </div>
  );
}

export function EpfQuickActions({
  onUpload,
  onExpandAll,
  onCollapseAll,
  selectedCount = 0,
  onDownloadSelected,
}: {
  onUpload: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  selectedCount?: number;
  onDownloadSelected?: () => void;
}) {
  const { t } = useT();
  const comingSoon = t("epf.actions.futurePhaseBadge");

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-[11px] font-medium tracking-wide text-muted uppercase">{t("epf.actions.availableGroup")}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={onUpload}>
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            {t("epf.actions.upload")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onExpandAll}>
            <ChevronsDown className="h-3.5 w-3.5" aria-hidden="true" />
            {t("epf.actions.expandAll")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCollapseAll}>
            <ChevronsUp className="h-3.5 w-3.5" aria-hidden="true" />
            {t("epf.actions.collapseAll")}
          </Button>
          {selectedCount > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={onDownloadSelected}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {t("epf.actions.downloadSelected")} ({selectedCount})
            </Button>
          ) : null}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-medium tracking-wide text-muted uppercase">{t("epf.actions.futureGroup")}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <FutureActionButton icon={Printer} label={t("epf.actions.printEpf")} comingSoon={comingSoon} />
          <FutureActionButton icon={FileOutput} label={t("epf.actions.exportPdf")} comingSoon={comingSoon} />
          <FutureActionButton icon={ScanText} label={t("epf.actions.ocr")} comingSoon={comingSoon} />
          <FutureActionButton icon={Sparkles} label={t("epf.actions.aiAnalysis")} comingSoon={comingSoon} />
        </div>
      </div>
    </div>
  );
}
