"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import {
  personsListFiltersToExportContext,
  type PersonsListExportFilters,
} from "@/lib/drug_intelligence/drug_export_persons_list_context";
import { drugIntelligenceClient } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { DrugExportPreviewV1 } from "@/lib/drug_intelligence/drug_export_types";
import { ApiClientError } from "@/lib/ui/api_client";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function DrugPersonListExportDrawer({
  open,
  onClose,
  filters,
  onGenerated,
}: {
  open: boolean;
  onClose: () => void;
  filters: PersonsListExportFilters;
  onGenerated?: () => void;
}) {
  const { user, can } = useAuth();
  const { t, language } = useT();
  const canFull = can("drug.edit");
  const [masking, setMasking] = useState<"MASKED" | "FULL">("MASKED");
  const [result, setResult] = useState<{ key: string; preview: DrugExportPreviewV1 | null; error: string | null } | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const previewKey = `${open}:${user?.id ?? ""}:${language}:${canFull ? masking : "MASKED"}:${JSON.stringify(filters)}`;
  const preview = result?.key === previewKey ? result.preview : null;
  const error = result?.key === previewKey ? result.error : null;
  const previewBusy = open && Boolean(user) && result?.key !== previewKey;
  const busy = previewBusy || downloadBusy;
  const hasQuery = Boolean(filters.searchQuery?.trim());

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    const key = previewKey;
    drugIntelligenceClient
      .previewExport({
        actorId: user.id,
        exportType: "OPERATIONAL_PERSONS",
        format: "CSV",
        masking: canFull ? masking : "MASKED",
        context: personsListFiltersToExportContext(filters, language),
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
  }, [open, user, filters, language, masking, canFull, t, previewKey]);

  async function download() {
    if (!user) return;
    setDownloadBusy(true);
    try {
      const downloaded = await drugIntelligenceClient.downloadExport({
        actorId: user.id,
        exportType: "OPERATIONAL_PERSONS",
        format: "CSV",
        masking: canFull ? masking : "MASKED",
        context: personsListFiltersToExportContext(filters, language),
      });
      triggerDownload(downloaded.blob, downloaded.filename);
      onGenerated?.();
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
    <Drawer open={open} onClose={onClose} titleId="drug-person-export-title" title={t("di.reports.personsCsvTitle")}>
      <div className="min-w-0 space-y-4 overflow-x-hidden px-5 py-4">
        <div>
          <p className="text-xs font-medium text-muted">{t("di.reports.personsCsvScopeLabel")}</p>
          <p className="mt-1 text-sm text-foreground">
            {hasQuery ? t("di.reports.personsCsvScopeQuery") : t("di.reports.personsCsvScopeAllActive")}
          </p>
          {hasQuery ? <p className="mt-1 text-sm text-muted">{filters.searchQuery}</p> : null}
        </div>
        {canFull ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted" htmlFor="person-export-masking">
              {t("di.export.maskingMode")}
            </label>
            <Select
              id="person-export-masking"
              value={masking}
              onChange={(e) => setMasking(e.target.value === "FULL" ? "FULL" : "MASKED")}
              options={[
                { value: "MASKED", label: t("di.export.masked") },
                { value: "FULL", label: t("di.export.full") },
              ]}
            />
          </div>
        ) : (
          <p className="text-sm text-muted">{t("di.export.masked")}</p>
        )}
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
          <Button type="button" size="sm" onClick={download} disabled={busy || !preview?.implemented} data-testid="persons-csv-download">
            <Download className="h-4 w-4" aria-hidden="true" />
            {t("di.export.downloadCsv")}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            {t("di.export.close")}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
